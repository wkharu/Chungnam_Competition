# -*- coding: utf-8 -*-
"""
통합 추천 파이프라인 v2
- 충남 14개 시군 전체 병렬 수집
- destinations.json 수동 태그로 자동 태그 덮어씀 (하이브리드)
- 30분 인메모리 캐시 (API 과호출 방지)
"""
import json
import time
import requests
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime

from lib.config import settings
from lib.daytrip_planner import normalize_intent
from lib.distance import calc_distance_score, get_user_coords
from lib.main_scoring import (
    adjust_components_for_precip_prob,
    adjust_main_score_for_party_duration,
    compute_main_components,
    contribution_points,
    explain_main_destination,
    weighted_main_score,
)
from lib.scoring import calc_weather_score
from lib.scoring_config import MAIN_WEIGHTS
from lib.auto_tag import auto_tag
from lib.storytelling_loader import load_storytelling_records
from lib.storytelling_match import match_storytelling_for_destination, storytelling_fields_for_api


SIGUNGU_CODES = {
    "공주": 1, "금산": 2, "논산": 3, "당진": 4,
    "보령": 5, "부여": 6, "서산": 7, "서천": 8,
    "아산": 9, "예산": 11, "천안": 12, "청양": 13,
    "태안": 14, "홍성": 15,
}

DESTINATIONS_PATH = Path(__file__).parent.parent / "data" / "destinations.json"

# ── 캐시 ──────────────────────────────────────────────
_cache: dict = {}          # { cache_key: (timestamp, data) }
CACHE_TTL = 1800           # 30분


def _cache_get(key: str):
    if key in _cache:
        ts, data = _cache[key]
        if time.time() - ts < CACHE_TTL:
            return data
    return None


def _cache_set(key: str, data):
    _cache[key] = (time.time(), data)


# ── 수동 태그 로드 ─────────────────────────────────────
def _load_manual() -> dict:
    """destinations.json을 {name: dest} 딕셔너리로 반환"""
    with open(DESTINATIONS_PATH, encoding="utf-8") as f:
        items = json.load(f)
    return {item["name"]: item for item in items}


# ── 단일 시군 수집 ─────────────────────────────────────
def _fetch_city(sigungu_code: int, num: int = 100) -> list:
    cache_key = f"city_{sigungu_code}"
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached

    if not settings.tour_api_key:
        return []

    params = {
        "serviceKey":  settings.tour_api_key,
        "numOfRows":   num,
        "pageNo":      1,
        "MobileOS":    "ETC",
        "MobileApp":   "ChungnamTour",
        "_type":       "json",
        "areaCode":    34,
        "sigunguCode": sigungu_code,
        "arrange":     "C",
    }
    try:
        r = requests.get(
            f"{settings.tour_base_url}/areaBasedList2",
            params=params,
            timeout=10,
        )
        data = r.json()
        if data["response"]["header"]["resultCode"] != "0000":
            return []
        body = data["response"]["body"]["items"]
        result = body["item"] if body else []
    except Exception:
        result = []

    # 숙박·쇼핑 제외
    result = [it for it in result if str(it.get("contenttypeid")) not in ("32", "38")]
    _cache_set(cache_key, result)
    return result


# ── 충남 전체 or 특정 도시 수집 ────────────────────────
def fetch_and_tag(city: str = "전체", num: int = 100) -> list:
    """
    city="전체"  → 14개 시군 병렬 수집 후 합산
    city="아산"  → 해당 도시만
    """
    manual = _load_manual()

    if city == "전체":
        codes = list(SIGUNGU_CODES.values())
    else:
        code = SIGUNGU_CODES.get(city)
        if code is None:
            raise ValueError(f"지원하지 않는 도시: {city}")
        codes = [code]

    # 병렬 수집
    raw_items = []
    with ThreadPoolExecutor(max_workers=7) as pool:
        futures = {pool.submit(_fetch_city, code, num): code for code in codes}
        for future in as_completed(futures):
            raw_items.extend(future.result())

    # 자동 태깅 + 수동 태그 덮어쓰기 (하이브리드)
    result = []
    for item in raw_items:
        tagged = auto_tag(item)
        name   = tagged["name"]

        if name in manual:
            # 수동 태그로 교체 (날씨 가중치, 태그, 카피 등)
            manual_data = manual[name].copy()
            # TourAPI에서만 얻을 수 있는 정보는 유지
            manual_data.setdefault("image",   tagged.get("image", ""))
            manual_data.setdefault("address", tagged.get("address", ""))
            manual_data["source"] = "manual"
            result.append(manual_data)
        else:
            result.append(tagged)

    # 수동 데이터 중 TourAPI에 없는 것도 추가 (도시 필터 적용)
    api_names = {d["name"] for d in result}
    for name, dest in manual.items():
        if name not in api_names:
            # 특정 도시 선택 시 해당 도시 수동 데이터만 추가
            if city != "전체" and dest.get("city") and dest["city"] != city:
                continue
            dest = dest.copy()
            dest["source"] = "manual"
            result.append(dest)

    return result


# ── 최종 매칭 ──────────────────────────────────────────
def match_from_api(
    weather: dict,
    city: str = "전체",
    top_n: int = 6,
    user_lat: float = None,
    user_lng: float = None,
    intent: dict | None = None,
) -> dict:
    """
    가중치(설명 가능): weather_fit, goal_fit, distance_fit, time_fit, season_event_bonus.
    intent가 없으면 기본 의도(healing, half-day 등)로 처리한다.

    홈페이지 `/api/recommend`의 **장소 후보 랭킹**은 항상 이 규칙 파이프라인만 사용한다.
    완성 코스 묶음·순서는 daytrip_planner·course_view에서 규칙으로 만들고,
    코스 단위 재정렬 ML은 lib.course_rerank(번들 있을 때만)에서 선택 적용한다.
    next_scene(/api/course)와 혼동하지 않는다.
    """
    scores = calc_weather_score(weather)
    destinations = fetch_and_tag(city)
    intent_use = intent if intent is not None else normalize_intent(
        None, None, None, None
    )

    ref_city = city if city != "전체" else "아산"
    if user_lat is None or user_lng is None:
        user_lat, user_lng = get_user_coords(ref_city)

    hour = int(weather.get("hour", datetime.now().hour))

    story_records = load_storytelling_records()

    results = []
    for dest in destinations:
        w = dest["weather_weights"]

        # Hard Filter (규칙 우선 — 홈페이지는 항상 이 경로만 사용)
        if scores["is_raining"] and dest["category"] == "outdoor":
            continue
        if scores["is_dust_bad"] and w.get("fine_dust_limit") == "good":
            continue

        lat = dest["coords"]["lat"]
        lng = dest["coords"]["lng"]
        dist_score, dist_km = calc_distance_score(lat, lng, user_lat, user_lng)

        components = compute_main_components(
            dest,
            weather,
            scores,
            intent_use,
            dist_score,
            hour=hour,
        )
        components = adjust_main_score_for_party_duration(
            dest, components, intent_use, dist_km
        )
        components = adjust_components_for_precip_prob(
            components, dest, float(weather.get("precip_prob", 0))
        )
        total = weighted_main_score(components)
        contrib = contribution_points(components)
        sm = (
            match_storytelling_for_destination(dest, story_records)
            if story_records
            else None
        )
        explain = explain_main_destination(
            dest, components, contrib, intent_use, weather, scores
        )
        if sm and sm.get("narrative_enrichment_line"):
            if float(sm.get("storytelling_match_confidence") or 0) >= 0.42:
                lines = list(explain.get("lines") or [])
                lines.append(str(sm["narrative_enrichment_line"]))
                explain = {**explain, "lines": lines[:5]}

        # 하위 호환: weather_score = 날씨 축 원시 적합도
        raw_w = components["weather_fit"]

        row = {
            **dest,
            "score": total,
            "weather_score": round(raw_w, 3),
            "distance_score": dist_score,
            "distance_km": dist_km,
            "address": dest.get("address") or "",
            "score_breakdown": components,
            "score_contributions": contrib,
            "recommendation_explain": explain,
            "recommendation_summary": explain.get("summary", ""),
        }
        row.update(storytelling_fields_for_api(sm))
        results.append(row)

    results.sort(key=lambda x: x["score"], reverse=True)

    return {
        "city": city,
        "user_coords": {"lat": user_lat, "lng": user_lng},
        "weather": scores,
        "total_fetched": len(destinations),
        "recommendations": results[:top_n],
        "main_scoring_model": {
            "weights": dict(MAIN_WEIGHTS),
            "intent_applied": intent_use,
            "note": "휴리스틱 가중 합; 각 항목은 0~1 부분점수. 인원·일정 길이 보정 포함(ML 미사용).",
        },
    }
