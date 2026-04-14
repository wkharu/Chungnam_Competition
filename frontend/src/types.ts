export interface Weather {
  temp: number
  precip_prob: number
  sky: number
  sky_text: string
  dust: number
}

export interface Scores {
  outdoor: number
  photo: number
  indoor: number
}

export interface Destination {
  name: string
  address: string
  tags: string[]
  score: number
  weather_score: number
  distance_km: number
  image?: string
  copy: string
}

export interface RecommendResponse {
  city: string
  weather: Weather
  scores: Scores
  total_fetched: number
  recommendations: Destination[]
}
