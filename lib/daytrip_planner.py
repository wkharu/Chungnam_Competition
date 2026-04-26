# -*- coding: utf-8 -*-
"""
날씨·의도·거리를 반영한 당일 코스(Plan A/B) 조합 및 API 페이로드.
"""
from __future__ import annotations

import math
from datetime import datetime, timezone
from typing import Any, Literal

from lib.distance import haversine
from lib.intent_hints import _COMPANION_HINTS, _GOAL_TAG_HINTS, _tags_lower
from lib.recommend_ui import build_ui_fields_for_destination
from lib.course_view import build_consumer_course_view

Companion = Literal["solo", "couple", "family", "friends"]
TripGoal = Literal["healing", "photo", "walking", "indoor", "culture", "kids"]
Duration = Literal["2h", "half-day", "full-day"]
Transport = Literal["car", "public"]


def normalize_intent(
    companion: str | None,
    trip_goal: str | None,
    duration: str | None,
    transport: str | None,
    *,
    adult_count: int | None = None,
    child_count: int | None = None,
) -> dict[str, str]:
    """쿼리/본문 값을 허용 집합으로 보정 (기본값 포함).

    adult_count / child_count가 None이면 동행·목적에 맞춰 보수적 기본값을 쓴다.
    홈페이지 규칙 엔진 전용(/api/recommend). next_scene(/api/course)와 무관.
    """
    c = (companion or "solo").lower().strip()
    g = (trip_goal or "healing").lower().strip()
    d = (duration or "half-day").lower().strip()
    t = (transport or "car").lower().strip()

    if c not in ("solo", "couple", "family", "friends"):
        c = "solo"
    if g not in ("healing", "photo", "walking", "indoor", "culture", "kids"):
        g = "healing"
    if d not in ("2h", "half-day", "full-day"):
        d = "half-day"
    if t not in ("car", "public"):
        t = "car"

    if adult_count is None:
        if c == "couple":
            adults = 2
        elif c == "friends":
            adults = 3
        elif c == "family":
            adults = 2
        else:
            adults = 1
    else:
        adults = max(1, min(10, int(adult_count)))

    if child_count is None:
        children = 0
        if c == "family":
            children = 1
        if g == "kids":
            children = max(children, 1)
    else:
        children = max(0, min(8, int(child_count)))

    return {
        "companion": c,
        "trip_goal": g,
        "duration": d,
        "transport": t,
        "adult_count": str(adults),
        "child_count": str(children),
    }


def intent_score_multiplier(dest: dict[str, Any], intent: dict[str, str]) -> float:
    """기존 종합 score에 곱해 의도에 맞게 순위만 가볍게 조정."""
    m = 1.0
    cat = dest.get("category") or ""
    tags = _tags_lower(dest)
    goal = intent["trip_goal"]
    comp = intent["companion"]

    for hint in _GOAL_TAG_HINTS.get(goal, ()):
        if any(hint.lower() in tg for tg in tags):
            m += 0.06
    if goal == "indoor" and cat == "indoor":
        m += 0.12

    for hint in _COMPANION_HINTS.get(comp, ()):
        if any(hint.lower() in tg for tg in tags):
            m += 0.04

    # 메타: companion_fit (선택 필드)
    cf = dest.get("companion_fit")
    if isinstance(cf, list) and comp in cf:
        m += 0.08

    return min(m, 1.45)


def target_place_count(duration: str) -> int:
    """Plan A/B에 넣을 장소 개수 — 일정 길이에 따라 명확히 구분."""
    if duration == "2h":
        return 2
    if duration == "half-day":
        return 3
    return 4


def with_adjusted_scores(
    recommendations: list[dict[str, Any]], intent: dict[str, str]
) -> list[dict[str, Any]]:
    """
    과거에는 의도를 곱셈 보정했으나, goal_fit이 match_from_api 총점에 포함됨.
    풀 정렬용으로 score 기준만 유지한다.
    """
    _ = intent
    out = [{**d, "adjusted_score": d.get("score", 0)} for d in recommendations]
    out.sort(key=lambda x: x["adjusted_score"], reverse=True)
    return out


def nearest_neighbor_order(
    places: list[dict[str, Any]], user_lat: float, user_lng: float
) -> list[dict[str, Any]]:
    """단순 이동 부담 추정용: 사용자 기준 근접 탐욕 순서 (내비게이션 경로 최적화 아님)."""
    if not places:
        return []
    remaining = places.copy()
    ordered: list[dict[str, Any]] = []
    cur_lat, cur_lng = user_lat, user_lng

    while remaining:
        best_i = 0
        best_d = math.inf
        for i, p in enumerate(remaining):
            lat = p["coords"]["lat"]
            lng = p["coords"]["lng"]
            if lat == 0 and lng == 0:
                dist = 9999.0
            else:
                dist = haversine(cur_lat, cur_lng, lat, lng)
            if dist < best_d:
                best_d = dist
                best_i = i
        nxt = remaining.pop(best_i)
        ordered.append(nxt)
        cur_lat = nxt["coords"]["lat"]
        cur_lng = nxt["coords"]["lng"]
    return ordered


def _pick_pool(adjusted: list[dict[str, Any]], pool_size: int = 24) -> list[dict[str, Any]]:
    return adjusted[: max(pool_size, 12)]


def _is_indoor_heavy_candidate(d: dict[str, Any]) -> bool:
    if d.get("category") == "indoor":
        return True
    w = d.get("weather_weights") or {}
    return float(w.get("rainy", 0)) >= 0.85


def _indoor_pick_predicate(
    d: dict[str, Any], *, category_only: bool
) -> bool:
    """강수 대비 메인 코스는 야외(우천 내성만 높음)를 실내로 오인하지 않도록 구분."""
    if category_only:
        return (d.get("category") or "") == "indoor"
    return _is_indoor_heavy_candidate(d)


def build_plan_places(
    pool: list[dict[str, Any]],
    n: int,
    user_lat: float,
    user_lng: float,
    exclude_names: set[str],
    prefer_indoor: bool,
    *,
    indoor_category_only: bool = False,
) -> list[dict[str, Any]]:
    """pool에서 조건에 맞게 n곡까지 선택 후 NN 정렬."""
    if n <= 0:
        return []
    filt: list[dict[str, Any]] = []
    for d in pool:
        if d["name"] in exclude_names:
            continue
        if prefer_indoor and not _indoor_pick_predicate(
            d, category_only=indoor_category_only
        ):
            continue
        filt.append(d)
    if prefer_indoor and len(filt) < n:
        for d in pool:
            if d["name"] in exclude_names or d in filt:
                continue
            if not _indoor_pick_predicate(d, category_only=indoor_category_only):
                continue
            filt.append(d)
            if len(filt) >= max(n * 3, 12):
                break
    if prefer_indoor and len(filt) < n and not indoor_category_only:
        for d in pool:
            if d["name"] in exclude_names or d in filt:
                continue
            filt.append(d)
            if len(filt) >= n * 2:
                break
    if not prefer_indoor and len(filt) < n:
        filt = [d for d in pool if d["name"] not in exclude_names][: max(n * 2, 8)]

    filt = filt[: max(n * 3, 9)]
    top = filt[:n] if len(filt) >= n else filt
    return nearest_neighbor_order(top, user_lat, user_lng)[:n]


def environment_triggers(weather: dict[str, Any], scores: dict[str, Any]) -> list[dict[str, str]]:
    """투명한 조건 코드 + 사람이 읽을 수 있는 문구."""
    triggers: list[dict[str, str]] = []
    pp = float(weather.get("precip_prob", 0))
    dust = int(weather.get("dust", 1))
    temp = float(weather.get("temp", 20))

    if pp >= 60:
        triggers.append(
            {
                "code": "precip_prob_ge_60",
                "label": "강수확률 60% 이상 — 실내·짧은 동선 우선 구간",
            }
        )
    elif pp >= 50:
        triggers.append(
            {
                "code": "precip_prob_ge_50",
                "label": "강수확률 50% 이상 — 실내·혼합 코스를 우선하는 구간",
            }
        )
    elif pp >= 30:
        triggers.append(
            {
                "code": "precip_prob_ge_30",
                "label": "강수확률 30% 이상 — 짧은 동선·실내 병행을 고려",
            }
        )

    if dust >= 3:
        triggers.append(
            {
                "code": "bad_fine_dust",
                "label": "미세먼지 나쁨 수준 — 실내·마스크 고려",
            }
        )

    if temp < 0 or temp > 33:
        triggers.append(
            {
                "code": "extreme_temperature",
                "label": "기온이 매우 낮거나 높음 — 체감·안전 확인",
            }
        )

    if scores.get("is_raining"):
        triggers.append(
            {
                "code": "precip_prob_model_rainy",
                "label": "강수확률이 높아 야외 활동에 제약이 있을 수 있음(예보 기준)",
            }
        )

    return triggers


def outdoor_heavy_trigger(plan_places: list[dict[str, Any]], duration: str) -> dict[str, str] | None:
    if duration == "2h":
        return None
    out = sum(1 for p in plan_places if p.get("category") == "outdoor")
    if out >= 2:
        return {
            "code": "plan_a_outdoor_heavy",
            "label": "Plan A가 야외 비중이 큼 — 대안(실내) 코스를 함께 제시",
        }
    return None


def _get_meta_str(dest: dict[str, Any], key: str, default: str = "") -> str:
    v = dest.get(key)
    return str(v) if v is not None else default


def _default_avg_stay(dest: dict[str, Any], duration: str) -> int:
    v = dest.get("avg_stay_minutes")
    if isinstance(v, (int, float)) and v > 0:
        return int(v)
    if duration == "2h":
        return 60
    if duration == "half-day":
        return 90
    return 120


def explain_place(
    dest: dict[str, Any],
    weather: dict[str, Any],
    scores: dict[str, Any],
    intent: dict[str, str],
) -> list[str]:
    """결정론적 설명 문장."""
    lines: list[str] = []
    if dest.get("recommendation_summary"):
        lines.append(str(dest["recommendation_summary"]))
    cat = dest.get("category", "")
    w = dest.get("weather_weights") or {}
    tags = dest.get("tags") or []

    if cat == "indoor":
        lines.append(
            f"실내형이라 비 올 때도 부담이 덜해요(우천 가중 {float(w.get('rainy', 0)):.1f})."
        )
    else:
        lines.append(
            f"야외형이라 맑은 날 가중({float(w.get('sunny', 0)):.1f})을 봤어요."
        )

    if dest.get("golden_hour_bonus") and scores.get("is_golden_hour"):
        lines.append("지금 시간대가 노을·사진에 유리할 수 있어요.")
    elif dest.get("golden_hour_bonus"):
        lines.append("노을·사진 포인트 태그가 있어요(시각은 달라질 수 있어요).")

    goal = intent["trip_goal"]
    hints = _GOAL_TAG_HINTS.get(goal, ())
    hit = [h for h in hints if any(h in str(t) for t in tags)]
    if hit:
        lines.append(f"여행 목표「{goal}」와 태그 키워드({', '.join(hit[:3])})가 맞닿습니다.")

    comp = intent["companion"]
    ch = _COMPANION_HINTS.get(comp, ())
    hit_c = [h for h in ch if any(h in str(t) for t in tags)]
    if hit_c:
        lines.append(f"동행 유형「{comp}」에 어울리는 태그({', '.join(hit_c[:2])})가 있습니다.")

    if dest.get("narrative_enrichment_line") and float(
        dest.get("storytelling_match_confidence") or 0
    ) >= 0.4:
        lines.append(str(dest["narrative_enrichment_line"]))

    return lines[:5]


def checks_for_plan(
    places: list[dict[str, Any]],
    intent: dict[str, str],
    weather: dict[str, Any],
    scores: dict[str, Any],
    plan_label: str,
) -> list[str]:
    """출발 전에 알아두면 좋은 점(짧게, 안내 톤)."""
    out: list[str] = []
    pp = float(weather.get("precip_prob", 0))
    dust = int(weather.get("dust", 1))
    out.append("운영시간과 휴무는 공식 채널에서 한 번 더 확인해 주세요.")

    if intent["transport"] == "car":
        out.append("주차는 현장·지도 앱으로 확인하는 것이 좋습니다.")
    else:
        out.append("대중교통은 배차·노선이 바뀔 수 있으니 출발 전 시간표를 확인해 주세요.")

    outd = sum(1 for p in places if p.get("category") == "outdoor")
    if outd >= 2:
        out.append("야외 비중이 높은 코스라 날씨가 바뀌면 대체 코스를 함께 보는 것이 좋습니다.")
    if pp >= 40:
        out.append("강수확률이 있는 편이라 우산·실내 대안을 챙기면 여유 있습니다.")
    if dust >= 3:
        out.append("미세먼지가 나쁜 날에는 실내 활동을 섞는 편이 편합니다.")

    if any(p.get("golden_hour_bonus") for p in places):
        out.append("사진·노을 목적이면 일몰 시각 전후로 맞추면 좋습니다.")

    return out[:6]


def plan_title(plan: str, intent: dict[str, str], indoor: bool) -> str:
    g = intent["trip_goal"]
    d = intent["duration"]
    if plan == "A":
        return f"오늘의 메인 코스 ({d}, 목표: {g})"
    if indoor:
        return "날씨 악화·실내 대안 코스 (Plan B)"
    return "대체 코스 (Plan B)"


def serialize_place(
    dest: dict[str, Any],
    weather: dict[str, Any],
    scores: dict[str, Any],
    intent: dict[str, str],
) -> dict[str, Any]:
    d_clear = {**dest}
    d_clear["recommendation_summary"] = None
    why_detailed = explain_place(d_clear, weather, scores, intent)[:4]
    ui = build_ui_fields_for_destination(dest, weather, scores, intent)
    concise = ui["concise_explanation_lines"]
    out: dict[str, Any] = {
        "id": dest.get("id", ""),
        "name": dest.get("name", ""),
        "city": dest.get("city", ""),
        "category": dest.get("category", ""),
        "tags": dest.get("tags", []),
        "score": dest.get("score"),
        "weather_score": dest.get("weather_score"),
        "distance_km": dest.get("distance_km"),
        "address": dest.get("address") or "",
        "copy": dest.get("copy", ""),
        "image": dest.get("image"),
        "coords": dest.get("coords"),
        "avg_stay_minutes": _default_avg_stay(dest, intent["duration"]),
        "activity_level": dest.get("activity_level") or "moderate",
        "opening_hours_note": dest.get("opening_hours_note"),
        "parking_note": dest.get("parking_note"),
        "why": concise,
        "why_detailed": why_detailed,
        "score_breakdown": dest.get("score_breakdown"),
        "score_contributions": dest.get("score_contributions"),
        "recommendation_summary": dest.get("recommendation_summary"),
        "total_score_100": ui["total_score_100"],
        "score_axis_display": ui["score_axis_display"],
        "top_reason_tokens": ui["top_reason_tokens"],
        "concise_explanation_lines": ui["concise_explanation_lines"],
        "why_recommend_bullets": ui.get("why_recommend_bullets"),
        "decision_conclusion": ui.get("decision_conclusion"),
        "lead_weather_sentence": ui.get("lead_weather_sentence"),
        "lead_place_sentence": ui.get("lead_place_sentence"),
        "practical_info": ui["practical_info"],
        "caution_lines": ui["caution_lines"],
        "place_identity": ui.get("place_identity"),
        "place_identity_summary": ui.get("place_identity_summary"),
        "why_today_narrative": ui.get("why_today_narrative"),
        "expectation_bullets": ui.get("expectation_bullets"),
        "expectation_points": ui.get("expectation_points"),
        "enriched_tags": ui.get("enriched_tags"),
        "narrative_archetype": ui.get("narrative_archetype"),
    }
    for _k in (
        "story_summary",
        "story_tags",
        "emotional_copy",
        "narrative_enrichment_line",
        "storytelling_match_confidence",
    ):
        if dest.get(_k) is not None:
            out[_k] = dest[_k]
    return out


def plan_why_summary(
    places: list[dict[str, Any]], weather: dict[str, Any], intent: dict[str, str]
) -> list[str]:
    lines = [
        "당일 단기예보와 정적 메타(태그·실내/야외)를 합쳐 순서를 잡았습니다.",
    ]
    if intent["transport"] == "public":
        lines.append("대중교통은 이동 시간 없이 순서만 제안합니다.")
    return lines


def _enrich_recommendation_row(
    rec: dict[str, Any],
    weather: dict[str, Any],
    scores: dict[str, Any],
    intent: dict[str, str],
    *,
    rank_index: int = 0,
    peer_scores: list[float] | None = None,
) -> dict[str, Any]:
    """랭킹 카드·API 하위 호환용으로 UI 설명 필드를 붙인다."""
    ui = build_ui_fields_for_destination(
        rec, weather, scores, intent, rank_index=rank_index, peer_scores=peer_scores
    )
    sl = {**rec, "recommendation_summary": None}
    detail = explain_place(sl, weather, scores, intent)[:4]
    return {
        **rec,
        **ui,
        "why": ui["concise_explanation_lines"],
        "why_detailed": detail,
    }


def build_daytrip_payload(
    *,
    weather: dict[str, Any],
    match_result: dict[str, Any],
    intent: dict[str, str],
) -> dict[str, Any]:
    """
    match_from_api 결과 + 날씨 원본 + 사용자 의도 → Plan A/B 및 메타.
    """
    scores = match_result["weather"]
    user_lat = match_result["user_coords"]["lat"]
    user_lng = match_result["user_coords"]["lng"]
    raw_recs = match_result["recommendations"]

    adjusted = with_adjusted_scores(raw_recs, intent)
    pool = _pick_pool(adjusted, 28)
    n = target_place_count(intent["duration"])
    n = min(n, len(pool)) if pool else 0

    pp = float(weather.get("precip_prob", 0) or 0)
    # 48% 이상이면 메인 코스를 실내 후보 풀에서 먼저 구성(50~60% ‘실내·혼합 우선’에 맞춤)
    rainy_main = pp >= 48.0

    pool_for_a = pool
    if rainy_main:
        in_ranked = [d for d in adjusted if (d.get("category") or "") == "indoor"]
        if in_ranked:
            pool_for_a = in_ranked[: max(40, n * 5)]

    names_a: set[str] = set()
    plan_a_raw: list[dict[str, Any]] = []
    if n > 0:
        plan_a_raw = build_plan_places(
            pool_for_a,
            n,
            user_lat,
            user_lng,
            set(),
            prefer_indoor=rainy_main,
            indoor_category_only=rainy_main,
        )
        names_a = {p["name"] for p in plan_a_raw}
        # 희귀 케이스: 플래너가 비었는데 후보는 있을 때 랭킹 상위로 코스 구성
        if not plan_a_raw and raw_recs:
            take = min(n, len(raw_recs))
            plan_a_raw = nearest_neighbor_order(raw_recs[:take], user_lat, user_lng)[
                :take
            ]
            names_a = {p["name"] for p in plan_a_raw}

    env_tr = environment_triggers(weather, scores)
    oh = outdoor_heavy_trigger(plan_a_raw, intent["duration"])
    if oh:
        env_tr = env_tr + [oh]

    plan_b_raw = build_plan_places(
        pool, n, user_lat, user_lng, names_a, prefer_indoor=not rainy_main
    )
    if not plan_b_raw and pool:
        # 실내 후보가 부족하면 Plan A와 겹치지 않게 뒤쪽 순위로 채움
        fallback = [p for p in pool if p["name"] not in names_a][:n]
        plan_b_raw = nearest_neighbor_order(fallback, user_lat, user_lng)
    if not plan_b_raw and raw_recs and names_a:
        alt = [p for p in raw_recs if p["name"] not in names_a][: max(n, 2)]
        if alt:
            plan_b_raw = nearest_neighbor_order(alt, user_lat, user_lng)[:n]

    names_ab = set(names_a) | {p["name"] for p in plan_b_raw}
    plan_c_raw: list[dict[str, Any]] = []
    if len(pool) > len(names_ab):
        plan_c_raw = build_plan_places(
            pool, n, user_lat, user_lng, names_ab, prefer_indoor=False
        )
    if plan_c_raw:
        set_c = frozenset(p["name"] for p in plan_c_raw)
        set_b = frozenset(p["name"] for p in plan_b_raw) if plan_b_raw else frozenset()
        if set_c == frozenset(names_a) or (plan_b_raw and set_c == set_b):
            plan_c_raw = []

    def avg_score(ps: list[dict[str, Any]]) -> float:
        if not ps:
            return 0.0
        return round(sum(p["score"] for p in ps) / len(ps), 3)

    plan_a_places = [serialize_place(p, weather, scores, intent) for p in plan_a_raw]
    plan_b_places = [serialize_place(p, weather, scores, intent) for p in plan_b_raw]
    plan_c_places = [serialize_place(p, weather, scores, intent) for p in plan_c_raw]

    sky_map = {1: "맑음", 3: "구름많음", 4: "흐림"}
    weather_summary = {
        "temp": weather["temp"],
        "precip_prob": weather["precip_prob"],
        "sky": weather["sky"],
        "sky_text": sky_map.get(int(weather.get("sky", 1)), "알수없음"),
        "dust": weather["dust"],
        "base_date": weather.get("base_date"),
        "base_time": weather.get("base_time"),
        "hour": weather.get("hour"),
    }

    input_summary = {
        "companion": intent["companion"],
        "trip_goal": intent["trip_goal"],
        "duration": intent["duration"],
        "transport": intent["transport"],
        "adult_count": intent.get("adult_count", "1"),
        "child_count": intent.get("child_count", "0"),
        "city": match_result["city"],
    }

    plan_a_checks = checks_for_plan(plan_a_raw, intent, weather, scores, "A")
    plan_b_checks = checks_for_plan(plan_b_raw, intent, weather, scores, "B")

    trigger_conditions = list(env_tr)
    b_indoor = all(_is_indoor_heavy_candidate(p) for p in plan_b_raw) if plan_b_raw else False

    generated_at = datetime.now(timezone.utc).isoformat()
    _rank_scores = [float(x.get("score", 0.0)) for x in raw_recs]

    _enriched = [
        _enrich_recommendation_row(
            r, weather, scores, intent, rank_index=i, peer_scores=_rank_scores
        )
        for i, r in enumerate(raw_recs)
    ]
    today_pitch: str = ""
    today_pitch_src: str = "none"
    if _enriched:
        from lib.today_course_pitch import (
            build_struct_from_top_recommendation,
            generate_today_course_pitch,
        )

        _struct = build_struct_from_top_recommendation(
            _enriched[0], weather, scores, intent
        )
        today_pitch, today_pitch_src = generate_today_course_pitch(_struct)

    out: dict[str, Any] = {
        "input_summary": input_summary,
        "user_coords": {"lat": user_lat, "lng": user_lng},
        "today_course_pitch": today_pitch,
        "today_course_pitch_source": today_pitch_src,
        "weather_summary": weather_summary,
        "plan_a": {
            "title": plan_title("A", intent, indoor=False),
            "places": plan_a_places,
            "score": avg_score(plan_a_raw),
            "why": plan_why_summary(plan_a_raw, weather, intent),
            "checks": plan_a_checks,
        },
        "plan_b": {
            "title": plan_title("B", intent, indoor=b_indoor),
            "places": plan_b_places,
            "score": avg_score(plan_b_raw),
            "why": plan_why_summary(plan_b_raw, weather, intent),
            "checks": plan_b_checks,
            "trigger_conditions": trigger_conditions,
        },
        "plan_c": {
            "title": "또 다른 동선 · 둘러보기 조합",
            "places": plan_c_places,
            "score": avg_score(plan_c_raw),
            "why": plan_why_summary(plan_c_raw, weather, intent) if plan_c_raw else [],
            "checks": checks_for_plan(plan_c_raw, intent, weather, scores, "C")
            if plan_c_raw
            else [],
        },
        "meta": {
            "generated_at": generated_at,
            "confidence_notes": [],
            "not_real_time_limitations": [],
        },
        "city": match_result["city"],
        "weather": {
            "temp": weather["temp"],
            "precip_prob": weather["precip_prob"],
            "sky": weather["sky"],
            "sky_text": weather_summary["sky_text"],
            "dust": weather["dust"],
        },
        "scores": scores,
        "total_fetched": match_result["total_fetched"],
        "recommendations": _enriched,
    }
    out.update(build_consumer_course_view(out))
    return out
