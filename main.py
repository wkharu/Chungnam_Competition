# -*- coding: utf-8 -*-
"""
충남 날씨 기반 관광지 추천 서비스
실행: python main.py  또는  uvicorn main:app --reload --host 127.0.0.1 --port 8000
"""
import sys
import os
import asyncio
import traceback
sys.path.insert(0, ".")

from lib.config import settings

settings.log_config_summary()
if settings.frontend_ui == "static":
    print(
        "[ui] no frontend/dist — root (/) is static/index.html (build how-to). "
        "cd frontend && npm run build, restart. Old one-page UI: /legacy. "
        "If .env has FRONTEND_UI=static, remove it (or set dist) after building.",
        file=sys.stderr,
    )

from fastapi import FastAPI, Query, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from lib.weather import fetch_weather
from lib.recommend import match_from_api
from lib.places import fetch_continuation_candidates, fetch_place_reviews
from lib.course_continuation import build_course_payload
from lib.daytrip_planner import build_daytrip_payload
from lib.intent_normalize import normalize_intent
from lib.scoring import calc_weather_score

app = FastAPI(title="충남 날씨 관광 추천")

FRONTEND_DIST = os.path.join(os.path.dirname(__file__), "frontend", "dist")
STATIC_DIR = os.path.join(os.path.dirname(__file__), "static")
LEGACY_APP = os.path.join(STATIC_DIR, "legacy_app.html")

# UI: lib.config.settings.frontend_ui — frontend/dist/index.html 이 있으면 기본 dist(Vite), 없으면 static.
# 강제: .env 에 FRONTEND_UI=static | dist
def _serve_vite_dist() -> bool:
    return settings.frontend_ui == "dist"


if os.path.isdir(FRONTEND_DIST) and _serve_vite_dist():
    app.mount("/assets", StaticFiles(directory=os.path.join(FRONTEND_DIST, "assets")), name="assets")


# ── API 라우트 (캐치올보다 반드시 먼저) ──────────────────────────────

@app.get("/api/recommend")
async def recommend(
    city: str = Query(default="아산"),
    top_n: int = Query(default=40),
    user_lat: float = Query(default=None),
    user_lng: float = Query(default=None),
    current_time: str | None = Query(
        default=None,
        description="현재 시각 HH:MM (코스·랭킹 시간축)",
    ),
    current_date: str | None = Query(
        default=None,
        description="방문 기준일 YYYY-MM-DD (시간표 시작일)",
    ),
    meal_preference: str | None = Query(
        default=None,
        description="식사 선호(자유 텍스트·짧게). 없으면 none",
    ),
    companion: str | None = Query(default=None),
    trip_goal: str | None = Query(default=None),
    duration: str | None = Query(default=None),
    transport: str | None = Query(default=None),
    adult_count: int | None = Query(default=None, ge=1, le=10),
    child_count: int | None = Query(default=None, ge=0, le=8),
):
    try:
        loop = asyncio.get_event_loop()

        weather = await loop.run_in_executor(
            None, fetch_weather, city if city != "전체" else "아산"
        )
        weather.setdefault("minute", 0)
        if current_time:
            parts = str(current_time).strip().split(":")
            try:
                weather["hour"] = int(parts[0]) % 24
            except (TypeError, ValueError):
                pass
            if len(parts) >= 2:
                try:
                    weather["minute"] = int(parts[1]) % 60
                except (TypeError, ValueError):
                    weather["minute"] = 0
        if current_date:
            ds = str(current_date).strip()
            if ds:
                weather["current_date_iso"] = ds
        intent = normalize_intent(
            companion,
            trip_goal,
            duration,
            transport,
            adult_count=adult_count,
            child_count=child_count,
            meal_preference=meal_preference,
        )
        pp0 = float(weather.get("precip_prob", 0) or 0)
        # 강수 48% 이상: 상위 N에 실내가 안 들어오는 경우가 있어 후보 깊이 확장
        match_top_n = max(int(top_n), 72) if pp0 >= 48 else int(top_n)
        match_top_n = min(match_top_n, 120)
        result = await loop.run_in_executor(
            None,
            lambda: match_from_api(
                weather,
                city,
                top_n=match_top_n,
                user_lat=user_lat,
                user_lng=user_lng,
                intent=intent,
            ),
        )
        trip_context = {
            "clock_hour": weather.get("hour"),
            "clock_minute": int(weather.get("minute", 0) or 0),
            "current_date_iso": weather.get("current_date_iso"),
            "meal_preference": intent.get("meal_preference"),
            "user_lat": user_lat,
            "user_lng": user_lng,
        }
        payload = await loop.run_in_executor(
            None,
            lambda: build_daytrip_payload(
                weather=weather,
                match_result=result,
                intent=intent,
                trip_context=trip_context,
            ),
        )
        # 단기예보·에어코리아 확장 필드 (Vite 앱·static 공통)
        w = payload["weather"]
        for k in (
            "pm25", "pm10", "air_source",
            "weather_fallback", "weather_fallback_note",
            "weather_source", "fcst_time_slot",
        ):
            if k in weather:
                w[k] = weather[k]

        return payload

    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/place-reviews")
async def place_reviews(
    name: str = Query(...),
    lat: float = Query(...),
    lng: float = Query(...),
    address: str = Query(default=""),
):
    """메인 추천 장소의 Google 리뷰 조회"""
    try:
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(
            None, lambda: fetch_place_reviews(name, lat, lng, address)
        )
        return result
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/course")
async def course(
    lat: float = Query(...),
    lng: float = Query(...),
    category: str = Query(default="outdoor"),
    hour: int = Query(default=12),
    companion: str | None = Query(default=None),
    trip_goal: str | None = Query(default=None),
    duration: str | None = Query(default=None),
    transport: str | None = Query(default=None),
    adult_count: int | None = Query(default=None, ge=1, le=10),
    child_count: int | None = Query(default=None, ge=0, le=8),
    precip_prob: float | None = Query(default=None),
    dust: int | None = Query(default=None),
    temp: float | None = Query(default=None),
    sky: int | None = Query(default=None),
    spot_id: str | None = Query(default=None),
    spot_name: str | None = Query(default=None),
    course_path: str | None = Query(default=None, description="ai | guided"),
    user_next_hint: str | None = Query(default=None, description="meal|cafe|quiet|photo|indoor|kids|custom"),
    user_custom_note: str | None = Query(default=None),
    ml_next_scene_assist: bool = Query(
        default=False,
        description="True일 때만 시나리오 next_scene 모델 보조(합성 학습). 홈페이지 기본값은 False.",
    ),
    desired_next_scene: str | None = Query(
        default=None,
        description="코스 재구성: meal|cafe_rest|indoor_backup|sunset_finish 등(시간대보다 우선).",
    ),
    desired_course_style: str | None = Query(default=None, description="향후 스타일 가중용(선택)"),
    family_bias: float = Query(default=0.0, ge=0.0, le=1.0),
    scenic_bias: float = Query(default=0.0, ge=0.0, le=1.0),
    indoor_bias: float = Query(default=0.0, ge=0.0, le=1.0),
    meal_bias: float = Query(default=0.0, ge=0.0, le=1.0),
    cafe_bias: float = Query(default=0.0, ge=0.0, le=1.0),
    reconfigure_target: str | None = Query(
        default=None,
        description="재구성 UX: 수정 대상 식별(top|active:main|active:alt:…|alt:…). 향후 분석·분기용.",
    ),
    selected_course_type: str | None = Query(
        default=None,
        description="재구성 UX: active|top|alternative",
    ),
    course_id: str | None = Query(
        default=None,
        description="재구성 UX: 편집 기준 코스 id(있을 때)",
    ),
    replace_step: bool = Query(default=False, description="True면 단계 교체 후보만(리뷰 메타 재랭킹 포함)"),
    step_index: int | None = Query(default=None, ge=0, le=20, description="교체 대상 단계 인덱스(0부터)"),
    step_role: str | None = Query(
        default=None,
        description="교체 대상 단계 역할(main_spot|meal|cafe_rest|secondary_spot|finish)",
    ),
    time_band: str | None = Query(
        default=None,
        description="morning|lunch|afternoon|evening|night|early — 비우면 서버가 hour로 산출",
    ),
):
    """코스 이어가기 — 다음 장면(단계) 결정 후 Places 후보를 재랭킹."""
    try:
        loop = asyncio.get_event_loop()
        intent = normalize_intent(
            companion,
            trip_goal,
            duration,
            transport,
            adult_count=adult_count,
            child_count=child_count,
        )
        wmin = {
            "temp": float(temp) if temp is not None else 20.0,
            "precip_prob": float(precip_prob) if precip_prob is not None else 0.0,
            "sky": int(sky) if sky is not None else 1,
            "dust": int(dust) if dust is not None else 1,
            "hour": hour,
        }
        scores_ctx = calc_weather_score(wmin)

        def _run():
            return build_course_payload(
                lat=lat,
                lng=lng,
                category=category,
                hour=hour,
                intent=intent,
                scores=scores_ctx,
                precip_prob=wmin["precip_prob"],
                dust=wmin["dust"],
                temp=wmin["temp"],
                spot_id=spot_id,
                spot_name=spot_name,
                fetch_places_fn=fetch_continuation_candidates,
                course_path=course_path,
                user_next_hint=user_next_hint,
                user_custom_note=user_custom_note,
                use_ml_next_scene_assist=ml_next_scene_assist,
                desired_next_scene=desired_next_scene,
                desired_course_style=desired_course_style,
                family_bias=family_bias,
                scenic_bias=scenic_bias,
                indoor_bias=indoor_bias,
                meal_bias=meal_bias,
                cafe_bias=cafe_bias,
                replace_step=replace_step,
                replace_step_index=step_index,
                replace_step_role=step_role,
                time_band=time_band,
            )

        payload = await loop.run_in_executor(None, _run)
        return payload
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# ── 프론트엔드 서빙 (항상 마지막에) ─────────────────────────────────

def _index():
    if os.path.isdir(FRONTEND_DIST) and _serve_vite_dist():
        return FileResponse(os.path.join(FRONTEND_DIST, "index.html"))
    return FileResponse(os.path.join(STATIC_DIR, "index.html"))

@app.get("/")
async def root():
    return _index()


@app.get("/legacy")
async def legacy_spa():
    """옛 단일 HTML 프로토(날씨·필터가 한 화면에 있는 UI). / 는 dist 없을 때 빌드 안내."""
    if not os.path.isfile(LEGACY_APP):
        raise HTTPException(status_code=404, detail="legacy_app.html not found")
    return FileResponse(LEGACY_APP)


@app.get("/{full_path:path}")
async def spa_fallback(full_path: str):
    return _index()


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=settings.port)
