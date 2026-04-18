# -*- coding: utf-8 -*-
"""
Google Places API (New) 연동
- 특정 좌표 근처 식당/카페 검색
- 코스 추천에 활용
"""
import os
import time
import requests
from dotenv import load_dotenv

load_dotenv()

API_KEY  = os.getenv("GOOGLE_PLACES_KEY")
BASE_URL = "https://places.googleapis.com/v1/places:searchNearby"

FIELD_MASK = ",".join([
    "places.displayName",
    "places.rating",
    "places.userRatingCount",
    "places.formattedAddress",
    "places.location",
    "places.currentOpeningHours",
    "places.photos",
    "places.types",
    "places.priceLevel",
    "places.reviews",
    "places.websiteUri",
    "places.googleMapsUri",
])

# 현재 장소 카테고리 → 다음 코스 타입 결정
def next_types(target_category: str, hour: int) -> list[str]:
    """사용자가 선택한 다음 코스 카테고리 → Places API 타입"""
    if target_category == "restaurant":
        if 17 < hour <= 22:
            return ["restaurant", "korean_restaurant", "japanese_restaurant"]
        return ["restaurant", "korean_restaurant", "chinese_restaurant"]
    elif target_category == "cafe":
        return ["cafe", "coffee_shop", "bakery"]
    elif target_category == "attraction":
        return ["tourist_attraction", "museum", "park", "art_gallery"]
    else:
        return ["restaurant", "korean_restaurant"]

# ── 인메모리 캐시 (좌표 반올림해서 캐시키로) ──────────────
_cache: dict = {}
CACHE_TTL = 1800  # 30분


def _cache_key(lat: float, lng: float, types: list) -> str:
    return f"{round(lat,3)}_{round(lng,3)}_{'_'.join(types[:1])}"


def fetch_next_places(
    lat: float,
    lng: float,
    current_category: str = "outdoor",
    hour: int = 12,
    radius_m: int = 5000,
    max_results: int = 5,
) -> list[dict]:
    """
    주어진 좌표 근처에서 다음 코스 장소 반환
    반환: [{ name, address, rating, review_count, open_now, photo_url, types }]
    """
    if not API_KEY:
        return []

    types = next_types(current_category, hour)
    key   = _cache_key(lat, lng, types)

    if key in _cache:
        ts, data = _cache[key]
        if time.time() - ts < CACHE_TTL:
            return data

    payload = {
        "includedTypes": types[:3],
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
        "X-Goog-Api-Key": API_KEY,
        "X-Goog-FieldMask": FIELD_MASK,
    }

    try:
        r = requests.post(BASE_URL, json=payload, headers=headers, timeout=8)
        r.raise_for_status()
        raw = r.json().get("places", [])
    except Exception:
        return []

    results = []
    for p in raw:
        rating = p.get("rating", 0)
        reviews = p.get("userRatingCount", 0)
        if rating < 3.0 or reviews < 3:    # 저품질 제외
            continue

        # 사진 URL (첫 번째)
        photo_url = None
        photos = p.get("photos", [])
        if photos:
            ref = photos[0].get("name", "")
            if ref:
                photo_url = (
                    f"https://places.googleapis.com/v1/{ref}/media"
                    f"?maxHeightPx=400&key={API_KEY}"
                )

        open_now = None
        oh = p.get("currentOpeningHours", {})
        if "openNow" in oh:
            open_now = oh["openNow"]

        # 리뷰 최대 3개
        raw_reviews = p.get("reviews", [])[:3]
        review_list = [
            {
                "author":   r.get("authorAttribution", {}).get("displayName", "익명"),
                "rating":   r.get("rating", 0),
                "text":     r.get("text", {}).get("text", ""),
                "relative": r.get("relativePublishTimeDescription", ""),
            }
            for r in raw_reviews
            if r.get("text", {}).get("text", "")
        ]

        results.append({
            "name":         p["displayName"]["text"],
            "address":      p.get("formattedAddress", ""),
            "rating":       rating,
            "review_count": reviews,
            "open_now":     open_now,
            "photo_url":    photo_url,
            "types":        p.get("types", []),
            "lat":          p["location"]["latitude"],
            "lng":          p["location"]["longitude"],
            "reviews":      review_list,
            "website":      p.get("websiteUri", ""),
            "google_maps":  p.get("googleMapsUri", ""),
        })

    _cache[key] = (time.time(), results)
    return results
