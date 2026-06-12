import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { AuthService, SignupData, LoginData, UserResponse } from '../../services/authService';
import { TokenStorage } from '../../utils/tokenStorage';

interface AuthState {
  user: UserResponse | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  role: 'CANDIDATE' | 'RECRUITER' | null;
  loading: boolean;
  error: string | null;
}

const initialState: AuthState = {
  user: null,
  accessToken: null,
  refreshToken: null,
  isAuthenticated: false,
  role: null,
  loading: false,
  error: null,
};

// ─── Thunks ──────────────────────────────────────────────────────────────────

export const signupThunk = createAsyncThunk(
  'auth/signup',
  async (data: SignupData, { rejectWithValue }) => {
    try {
      const tokens = await AuthService.signup(data);
      await TokenStorage.saveTokens(tokens.access_token, tokens.refresh_token);
      const user = await AuthService.getMe();
      return { tokens, user };
    } catch (e: any) {
      return rejectWithValue(e.response?.data?.detail || 'Signup failed');
    }
  }
);

export const loginThunk = createAsyncThunk(
  'auth/login',
  async (data: LoginData, { rejectWithValue }) => {
    try {
      const tokens = await AuthService.login(data);
      await TokenStorage.saveTokens(tokens.access_token, tokens.refresh_token);
      const user = await AuthService.getMe();
      return { tokens, user };
    } catch (e: any) {
      return rejectWithValue(e.response?.data?.detail || 'Login failed');
    }
  }
);

export const logoutThunk = createAsyncThunk('auth/logout', async () => {
  try {
    await AuthService.logout();
  } catch {
    // Ignore server errors on logout; always clear local tokens
  }
  await TokenStorage.clearTokens();
});

export const loadUserThunk = createAsyncThunk(
  'auth/loadUser',
  async (_, { rejectWithValue }) => {
    try {
      const token = await TokenStorage.getAccessToken();
      if (!token) return rejectWithValue('No token');
      const user = await AuthService.getMe();
      const refreshToken = await TokenStorage.getRefreshToken();
      return { user, accessToken: token, refreshToken };
    } catch (e: any) {
      return rejectWithValue('Session expired');
    }
  }
);

// ─── Slice ────────────────────────────────────────────────────────────────────

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    setTokens: (
      state,
      action: PayloadAction<{ accessToken: string; refreshToken: string }>
    ) => {
      state.accessToken = action.payload.accessToken;
      state.refreshToken = action.payload.refreshToken;
    },
  },
  extraReducers: (builder) => {
    // ── Signup ──────────────────────────────────────────────────────────────
    builder.addCase(signupThunk.pending, (state) => {
      state.loading = true;
      state.error = null;
    });
    builder.addCase(signupThunk.fulfilled, (state, action) => {
      state.loading = false;
      state.isAuthenticated = true;
      state.accessToken = action.payload.tokens.access_token;
      state.refreshToken = action.payload.tokens.refresh_token;
      state.user = action.payload.user;
      state.role = action.payload.user.roles[0] as 'CANDIDATE' | 'RECRUITER';
    });
    builder.addCase(signupThunk.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload as string;
    });

    // ── Login ───────────────────────────────────────────────────────────────
    builder.addCase(loginThunk.pending, (state) => {
      state.loading = true;
      state.error = null;
    });
    builder.addCase(loginThunk.fulfilled, (state, action) => {
      state.loading = false;
      state.isAuthenticated = true;
      state.accessToken = action.payload.tokens.access_token;
      state.refreshToken = action.payload.tokens.refresh_token;
      state.user = action.payload.user;
      state.role = action.payload.user.roles[0] as 'CANDIDATE' | 'RECRUITER';
    });
    builder.addCase(loginThunk.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload as string;
    });

    // ── Logout ──────────────────────────────────────────────────────────────
    builder.addCase(logoutThunk.fulfilled, (_state) => {
      return initialState;
    });

    // ── Load User ───────────────────────────────────────────────────────────
    builder.addCase(loadUserThunk.fulfilled, (state, action) => {
      state.isAuthenticated = true;
      state.user = action.payload.user;
      state.accessToken = action.payload.accessToken;
      state.refreshToken = action.payload.refreshToken ?? null;
      state.role = action.payload.user.roles[0] as 'CANDIDATE' | 'RECRUITER';
    });
    builder.addCase(loadUserThunk.rejected, (state) => {
      state.isAuthenticated = false;
      state.user = null;
      state.accessToken = null;
      state.refreshToken = null;
      state.role = null;
    });
  },
});

export const { clearError, setTokens } = authSlice.actions;
export default authSlice.reducer;
