# -*- coding: utf-8 -*-
"""
Google Places API (New) 연동
- 특정 좌표 근처 식당/카페 검색
- 코스 추천에 활용

참고: 신규 장소는 rating/userRatingCount가 비어 있는 경우가 많아,
과도한 품질 필터는 빈 목록만 만들 수 있음 → 완화함.
"""
from __future__ import annotations

import sys
from typing import Any
import time
import requests

from lib.citytour_restaurant_client import fetch_citytour_restaurant_candidates
from lib.config import settings
from lib.daytrip_planner import normalize_intent
from lib.next_course_scoring import rank_next_places
from lib.restaurant_candidates import merge_restaurant_candidate_lists
from lib.scoring import calc_weather_score

FIELD_MASK = ",".join([
    "places.id",
    "places.displayName",
    "places.rating",
    "places.userRatingCount",
    "places.formattedAddress",
    "places.location",
    "places.currentOpeningHours",
    "places.photos",
    "places.types",
    "places.priceLevel",
])

# 현재 장소 카테고리 → 다음 코스 타입 결정
def next_types(current_category: str, hour: int) -> list[str]:
    if current_category == "restaurant":
        # 식사 후 → 카페/디저트
        return ["cafe", "coffee_shop", "bakery"]
    elif current_category == "cafe":
        # 카페 후 → 저녁 식사
        return ["restaurant", "korean_restaurant"]
    else:
        # 관광지(outdoor/indoor) 후 → 식사 우선 (시간 무관)
        if 17 < hour <= 22:
            return ["restaurant", "korean_restaurant", "japanese_restaurant"]
        else:
            return ["restaurant", "korean_restaurant", "chinese_restaurant"]

# ── 인메모리 캐시 (좌표 반올림해서 캐시키로) ──────────────
_cache: dict = {}
CACHE_TTL = 1800  # 30분


def _cache_key(lat: float, lng: float, types: list, trip_goal: str) -> str:
    return f"{round(lat,3)}_{round(lng,3)}_{trip_goal}_{'_'.join(types[:2])}"


def _expected_meal_from_types(types: list[str]) -> bool:
    """검색 타입이 식사 위주면 True, 카페·베이커리 위주면 False."""
    if not types:
        return True
    if types[0] in ("cafe", "coffee_shop", "bakery"):
        return False
    return True


def _display_name(p: dict) -> str:
    dn = p.get("displayName") or {}
    if isinstance(dn, dict):
        return str(dn.get("text") or "").strip()
    return str(dn).strip()


def _should_skip_low_quality(rating: float | None, reviews: int) -> bool:
    """평점·리뷰가 충분히 있을 때만 매우 낮은 곳 제외."""
    if rating is None:
        return False
    if rating < 2.0:
        return True
    if reviews >= 5 and rating < 2.5:
        return True
    return False


def _search_nearby_raw(
    included_types: list[str],
    lat: float,
    lng: float,
    radius_m: float,
    max_results: int,
) -> list[dict]:
    payload = {
        "includedTypes": included_types[:10],
        "maxResultCount": max_results,
        "locationRestriction": {
            "circle": {
                "center": {"latitude": lat, "longitude": lng},
                "radius": float(radius_m),
            }
        },
        "rankPreference": "POPULARITY",
    }
    headers = {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": settings.google_places_key,
        "X-Goog-FieldMask": FIELD_MASK,
    }
    r = requests.post(
        settings.google_places_search_url,
        json=payload,
        headers=headers,
        timeout=12,
    )
    if not r.ok:
        if settings.debug:
            print(
                f"[places] HTTP {r.status_code} (types={included_types[:2]})",
                file=sys.stderr,
            )
        r.raise_for_status()
    return list(r.json().get("places") or [])


def _raw_to_results(raw: list[dict]) -> list[dict]:
    results: list[dict] = []
    for p in raw:
        rating_v = p.get("rating")
        try:
            rating = float(rating_v) if rating_v is not None else None
        except (TypeError, ValueError):
            rating = None
        try:
            reviews = int(p.get("userRatingCount") or 0)
        except (TypeError, ValueError):
            reviews = 0

        if _should_skip_low_quality(rating, reviews):
            continue

        name = _display_name(p)
        if not name:
            continue

        loc = p.get("location") or {}
        try:
            plat = float(loc.get("latitude"))
            plng = float(loc.get("longitude"))
        except (TypeError, ValueError):
            continue

        photo_url = None
        photos = p.get("photos") or []
        if photos:
            ref = photos[0].get("name", "")
            if ref:
                root = settings.google_places_v1_root
                photo_url = (
                    f"{root}/{ref}/media"
                    f"?maxHeightPx=400&key={settings.google_places_key}"
                )

        open_now = None
        oh = p.get("currentOpeningHours") or {}
        if "openNow" in oh:
            open_now = oh["openNow"]

        r_show = float(rating) if rating is not None else 0.0
        pid = p.get("id")
        results.append({
            "place_id":     str(pid) if pid is not None else "",
            "name":         name,
            "address":      p.get("formattedAddress") or "",
            "rating":       r_show,
            "review_count": reviews,
            "open_now":     open_now,
            "photo_url":    photo_url,
            "types":        p.get("types") or [],
            "lat":          plat,
            "lng":          plng,
            "source_type": "google_places",
            "source_mix": "google_places",
            "merged_candidate_flag": False,
            "public_data_match": False,
        })

    # 평점·리뷰 있는 항목 우선
    results.sort(
        key=lambda x: (x["rating"], x["review_count"]),
        reverse=True,
    )
    return results


def _merge_public_restaurants(
    google_results: list[dict],
    lat: float,
    lng: float,
    max_results: int,
) -> list[dict]:
    ct = fetch_citytour_restaurant_candidates(lat, lng, max_results=max_results)
    merged = merge_restaurant_candidate_lists(google_results, ct, lat, lng)
    out: list[dict] = []
    for r in merged:
        row = dict(r)
        row.setdefault("source_type", "google_places")
        row.setdefault("source_mix", "google_places")
        row.setdefault("merged_candidate_flag", False)
        row.setdefault("public_data_match", False)
        out.append(row)
    return out


def fetch_continuation_candidates(
    lat: float,
    lng: float,
    included_types: list[str],
    max_results: int = 14,
) -> tuple[list[dict], float, bool, str | None]:
    """
    코스 이어가기용 Places 후보만 수집. 반경·타입을 단계적으로 완화한다.
    반환: (결과, 사용한 반경 m, 완화 여부, 메모)
    """
    radii = (8000.0, 14000.0, 22000.0)
    fallback_note: str | None = None

    if not settings.google_places_key:
        merged = _merge_public_restaurants([], lat, lng, max_results)
        if merged:
            return merged, 0.0, True, "GOOGLE_PLACES_KEY 미설정 · 공공 식당 데이터 보강"
        return [], 0.0, True, "GOOGLE_PLACES_KEY 미설정"

    for radius_m in radii:
        try:
            raw = _search_nearby_raw(included_types[:10], lat, lng, radius_m, max_results)
        except Exception:
            raw = []
        results = _raw_to_results(raw)
        results = _merge_public_restaurants(results, lat, lng, max_results)
        if results:
            extras: list[str] = []
            if any(p.get("source_type") == "citytour_api" for p in results):
                extras.append("공공 식당 데이터 병합")
            note_fin = " · ".join(extras) if extras else None
            return results, radius_m, False, note_fin

    for relaxed in (
        ["restaurant", "cafe", "coffee_shop"],
        ["tourist_attraction", "park"],
        ["meal_takeaway", "bakery"],
    ):
        for radius_m in radii:
            try:
                raw = _search_nearby_raw(relaxed, lat, lng, radius_m, max_results)
            except Exception:
                raw = []
            results = _raw_to_results(raw)
            results = _merge_public_restaurants(results, lat, lng, max_results)
            if results:
                note = "후보 부족 시 검색 타입·반경 완화"
                if any(p.get("source_type") == "citytour_api" for p in results):
                    note += " · 공공 식당 데이터 병합"
                return results, radius_m, True, note

    merged_only = _merge_public_restaurants([], lat, lng, max_results)
    if merged_only:
        return merged_only, radii[-1], True, "주변 Places 결과 없음 · 공공 식당 데이터"

    return [], radii[-1], True, "주변 Places 결과 없음"


def fetch_next_places(
    lat: float,
    lng: float,
    current_category: str = "outdoor",
    hour: int = 12,
    radius_m: int = 10000,
    max_results: int = 12,
    intent: dict | None = None,
    scores: dict[str, Any] | None = None,
) -> list[dict]:
    """
    주어진 좌표 근처에서 다음 코스 장소 반환.
    거리·단계·품질·목적·날씨 보조 점수로 정렬하며 breakdown을 붙인다.
    """
    if not settings.google_places_key:
        return []

    intent_use = intent if intent is not None else normalize_intent(
        None, None, None, None
    )
    goal_key = intent_use.get("trip_goal", "healing")

    types = next_types(current_category, hour)
    expected_meal = _expected_meal_from_types(types)
    key = _cache_key(lat, lng, types, goal_key)

    if key in _cache:
        ts, data = _cache[key]
        if time.time() - ts < CACHE_TTL:
            return data

    raw: list[dict] = []
    try:
        raw = _search_nearby_raw(types[:3], lat, lng, radius_m, max_results)
    except Exception:
        raw = []

    if not raw:
        for fallback_types in (
            ["restaurant"],
            ["meal_takeaway", "restaurant"],
            ["cafe", "coffee_shop"],
        ):
            try:
                raw = _search_nearby_raw(fallback_types, lat, lng, radius_m, max_results)
            except Exception:
                raw = []
            if raw:
                expected_meal = _expected_meal_from_types(fallback_types)
                break

    results = _raw_to_results(raw)
    scores_use = scores
    if scores_use is None:
        scores_use = calc_weather_score(
            {
                "temp": 20.0,
                "precip_prob": 0.0,
                "sky": 1,
                "dust": 1,
                "hour": hour,
            }
        )

    ranked = rank_next_places(
        results,
        ref_lat=lat,
        ref_lng=lng,
        hour=hour,
        intent=intent_use,
        scores=scores_use,
        expected_meal=expected_meal,
    )
    _cache[key] = (time.time(), ranked)
    return ranked
