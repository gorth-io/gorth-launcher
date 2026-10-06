export interface AuthViewState {
  url?: string;
  completed?: boolean;
  visible: boolean;
  mode: "login" | "register";
  loading: boolean;
  verifying: boolean;
  error: string;
}

export interface AuthViewBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}
