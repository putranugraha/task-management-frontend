// Shared auth types and contracts (Step 1: types only, no logic yet)

export type AuthUser = {
  id: number;
  name: string;
  email: string;
  // Tambahkan properti lain dari UserResource jika diperlukan
  [key: string]: unknown;
};

export type PrimaryRole = "Admin" | "Manager" | "Member" | null;

export type DashboardType = "admin" | "manager" | "member" | null;

export type AuthState = {
  user: AuthUser | null;
  roles: string[];
  permissions: string[];
  primary_role: PrimaryRole;
  dashboard_type: DashboardType;
  home_path: string | null;
  token: string | null;
  isLoading: boolean;
  isInitialized: boolean;
};

export type AuthContextValue = {
  state: AuthState;
  // Fungsi-fungsi ini akan diimplementasikan pada step berikutnya
  login: (email: string, password: string) => Promise<LoginResponse | void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  hasRole: (role: Exclude<PrimaryRole, null>) => boolean;
  can: (permission: string) => boolean;
};

// Helper default state yang bisa dipakai nanti di AuthProvider
export const initialAuthState: AuthState = {
  user: null,
  roles: [],
  permissions: [],
  primary_role: null,
  dashboard_type: null,
  home_path: null,
  token: null,
  isLoading: false,
  isInitialized: false,
};

export type LoginResponse = {
  user?: AuthUser;
  roles?: string[];
  permissions?: string[];
  primary_role?: PrimaryRole;
  dashboard_type?: DashboardType;
  home_path?: string | null;
  token?: string;
  access_token?: string;
  token_type?: string;
  message?: string;
};
