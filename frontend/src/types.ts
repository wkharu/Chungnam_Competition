export interface Weather {
  temp: number
  precip_prob: number
  sky: number
  sky_text: string
  dust: number
  /** 에어코리아 시도 평균 등 연동 시 */
  pm25?: number | null
  pm10?: number | null
  air_source?: string | null
  /** 기상청 호출 실패 시 대체 값 */
  weather_fallback?: boolean
  weather_fallback_note?: string | null
  /** vilagefcst | fallback */
  weather_source?: string | null
  /** 단기예보에서 골라 쓴 fcstTime 슬롯 (예: "1400") */
  fcst_time_slot?: string | null
}

export interface Scores {
  outdoor: number
  photo: number
  indoor: number
}

export interface ScoreAxisDisplay {
  key: string
  label: string
  earned: number
  max: number
}

export interface PracticalInfo {
  distance_km?: number | null
  drive_minutes_approx?: number | null
  mobility_line: string
  mobility_line_distance?: string | null
  mobility_line_drive?: string | null
  transport_note: string
  /** 일정 길이별 규칙 설명 한 줄 */
  duration_fit_line?: string
}

export interface Destination {
  id?: string
  name: string
  address: string
  tags: string[]
  score: number
  weather_score: number
  distance_km: number
  image?: string
  copy: string
  category?: string
  coords?: { lat: number; lng: number }
  /** 메인 추천 휴리스틱 부분점수 0~1 */
  score_breakdown?: Record<string, number>
  score_contributions?: Record<string, number>
  recommendation_summary?: string
  total_score_100?: number
  score_axis_display?: ScoreAxisDisplay[]
  top_reason_tokens?: string[]
  concise_explanation_lines?: string[]
  practical_info?: PracticalInfo
  caution_lines?: string[]
  why?: string[]
  why_detailed?: string[]
  /** 결론 우선 라벨 (점수 대신) */
  decision_conclusion?: string
  lead_weather_sentence?: string
  lead_place_sentence?: string
  why_recommend_bullets?: string[]
  /** 스토리텔링 CSV 매칭 시 */
  story_summary?: string | null
  story_tags?: string[]
  emotional_copy?: string | null
  narrative_enrichment_line?: string | null
  storytelling_match_confidence?: number
  /** 4층 내러티브 — 장소 정체성 한 줄 */
  place_identity?: string
  /** 짧은 유형 요약(설명 레이어) */
  place_identity_summary?: string
  /** 오늘 맥락(일정·날씨 등) */
  why_today_narrative?: string
  /** 기대 포인트 불릿 */
  expectation_bullets?: string[]
  /** 기대 포인트( place_identity_summary 와 쌍) */
  expectation_points?: string[]
  /** 키워드·규칙으로 붙인 시맨틱 태그 */
  enriched_tags?: string[]
  narrative_archetype?: string
  /** Google Places 등(있을 때만) */
  rating?: number
  review_count?: number
}

export interface NextPlace {
  place_id?: string
  name: string
  address: string
  rating: number
  review_count: number
  open_now: boolean | null
  photo_url: string | null
  types: string[]
  lat: number
  lng: number
  next_course_score?: number
  /** 0~100 환산 점수(식사 랭킹용) */
  score_100?: number
  score_breakdown?: Record<string, number>
  recommendation_reason_one_line?: string
  distance_from_prev_km?: number
  source_type?: string
  source_mix?: string
  public_data_match?: boolean
  merged_candidate_flag?: boolean
}

/** /api/course 1순위 장소 블록 */
export interface PrimaryCoursePick {
  name: string
  score?: number
  place_id?: string
  source_type?: string
  source_mix?: string
  public_data_match?: boolean
  merged_candidate_flag?: boolean
  data_source_note?: string | null
  why?: string[]
  after_this?: string[]
  after_this_title?: string
  practical_info?: PracticalInfo
  drive_minutes_approx?: number | null
  score_breakdown?: Record<string, number>
  distance_from_prev_km?: number
  address?: string
  types?: string[]
}

/** /api/course — 다음 장면(신규 필드) */
export interface NextSceneBlock {
  type: string
  title: string
  why: string[]
  headline?: string
  /** 식사·실내 식사 단계: 왜 지금 끼니인지 */
  why_meal_now?: string[]
}

/** 실내 전환 등 고수준 장면 안의 구체 방식(식사/카페/실내 관람) */
export interface SceneModeBlock {
  type: string
  title: string
  why: string[]
}

/** /api/course — 레거시·실험: 다음 장면 보조(규칙 폴백). 홈 첫 추천과 별개 */
export interface MlNextSceneMeta {
  model_used?: boolean
  next_scene_reason_mode?: 'model-assisted' | 'rule-based'
  predicted_next_scene?: string | null
  rule_based_stage?: string
  scene_probs?: Record<string, number> | null
  top_features?: Array<{ feature: string; importance?: number }> | null
  /** API·디버그용(소비자 문구에 직접 쓰지 않음) */
  fallback_reason?: string | null
}

/** /api/course — 서버가 적용한 힌트·분기(개발·검증용, 소비자 문구에 직접 쓰지 않음) */
export interface CourseControlBlock {
  applied_user_hint?: string | null
  desired_next_scene?: string | null
  desired_course_style?: string | null
  effective_stage?: string
  decision_mode?: string
  next_scene_reason_mode?: string | null
  ml_model_used?: boolean
  bias?: {
    family?: number
    scenic?: number
    indoor?: number
    meal?: number
    cafe?: number
  }
}

/** /api/course — 코스 이어가기 응답 */
export interface CourseContinuationResponse {
  course_control?: CourseControlBlock
  course_path?: string
  guided_flow_notes?: string[]
  next_step_headline?: string
  next_scene?: NextSceneBlock
  /** 고수준 장면(indoor_transition 등)과 1순위 장소 사이의 중간 설명 */
  scene_mode?: SceneModeBlock
  next_stage: {
    type: string
    title: string
    why: string[]
    headline?: string
  }
  meal_style?: {
    key: string
    label: string
    secondary_key?: string | null
    secondary_label?: string | null
    why: string[]
    need_meal?: number
    need_rest?: number
  }
  /** 식사 스타일별 요리 편향(가산용, 한·중·일·서) */
  cuisine_bias?: Record<string, number>
  after_this?: string[]
  primary_recommendation: PrimaryCoursePick | null
  /** 장소만 요약(선택 필드, primary_recommendation과 동일 계열) */
  primary_place?: { name?: string; why?: string[]; after_this?: string[] } | null
  /** 식사 단계와 동일 블록(스키마 호환용 별칭) */
  primary_restaurant?: PrimaryCoursePick | null
  alternatives: NextPlace[]
  next_places: NextPlace[]
  meta: {
    radius_used: number
    fallback_applied: boolean
    trip_state?: Record<string, number>
    fallback_note?: string | null
    source_mix?: { google_places: number; citytour_api: number; merged_candidate_count: number }
    /** 2h | half-day | full-day — 코스 이어가기 깊이 */
    duration?: string
    continuation_depth_hint?: string
    /** indoor_backup이 meal/cafe/indoor_visit으로 구체화된 경우 */
    indoor_transition_split?: boolean
  }
  /** 규칙 폴백 가능한 약지도 next_scene 분류기 메타 */
  ml_next_scene?: MlNextSceneMeta
}

export interface RecommendInputSummary {
  companion: string
  trip_goal: string
  duration: string
  transport: string
  city: string
  adult_count?: string
  child_count?: string
}

export interface CourseBadge {
  key: string
  label: string
  value: string
}

export interface CourseSummary {
  headline: string
  one_liner: string
  badges: CourseBadge[]
  /** API 확장: 세션 요약(한글 라벨) */
  city?: string
  duration?: string
  companion?: string
  goal?: string
  weather_label?: string
  pitch?: string
}

/** /api/recommend 코스 후보 재정렬 메타(학습 번들 없으면 model_used=false) */
export interface CourseRerankMeta {
  enabled: boolean
  model_used: boolean
  rerank_mode: 'model-assisted' | 'rule-based'
  fallback_reason?: string | null
}

export interface CourseStep {
  order: number
  step_label: string
  name: string
  one_line: string
  image?: string | null
  address?: string
  /** 장소 소개(큐레이션·요약) */
  detail_intro?: string | null
  detail_bullets?: string[]
  tag_labels?: string[]
  /** Google Places 등에서 온 평점·리뷰 수(본문 리뷰 텍스트는 없음) */
  rating?: number | null
  review_count?: number
}

export interface TopCourse {
  id: string
  title: string
  pitch: string
  reasons_title: string
  reasons: string[]
  /** 코스 성격 태그(표시용) */
  reason_tags?: string[]
  steps: CourseStep[]
  hero_image?: string | null
  hero_name: string
  course_id?: string
  estimated_duration?: string
  movement_burden?: string
  weather_fit?: string
}

export interface AlternativeCourse {
  id: string
  title: string
  one_liner: string
  place_names: string[]
  /** 서버가 보낸 완성 코스면 상세·비교 화면에서 그대로 사용 */
  pitch?: string
  reasons_title?: string
  reasons?: string[]
  reason_tags?: string[]
  steps?: CourseStep[]
  hero_image?: string | null
  hero_name?: string
  course_id?: string
  estimated_duration?: string
  movement_burden?: string
  weather_fit?: string
}

export interface ServiceNotice {
  disclaimer: string
  details: string[]
  short?: string[]
}

export interface PlanBlock {
  title: string
  places: Destination[]
  score?: number
  why?: string[]
  checks?: string[]
}

export interface RecommendResponse {
  city: string
  weather: Weather
  scores: Scores
  total_fetched: number
  recommendations: Destination[]
  input_summary?: RecommendInputSummary
  today_course_pitch?: string
  today_course_pitch_source?: 'template' | 'ollama' | 'ollama_failed' | 'none'
  /** 소비자용 — 완성 코스 뷰 */
  summary?: CourseSummary
  top_course?: TopCourse
  alternative_courses?: AlternativeCourse[]
  course_rerank?: CourseRerankMeta
  notice?: ServiceNotice
  plan_a?: PlanBlock
  plan_b?: PlanBlock
  plan_c?: PlanBlock
  meta?: { generated_at?: string; confidence_notes?: string[]; not_real_time_limitations?: string[] }
}
