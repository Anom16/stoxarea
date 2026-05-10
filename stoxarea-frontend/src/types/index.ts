export type RiskProfile = 'Konservatif' | 'Moderat' | 'Agresif'

export interface Stock {
  ticker:   string
  name:     string
  sector:   string
  aiScore:  number
  roe:      number
  der:      number
  per:      number
  sawScore: number
  match:    number
}

export interface User {
  id:          string
  email:       string
  riskProfile: RiskProfile
  weights:     { k1: number; k2: number; k3: number; k4: number }
}
