import { configureStore } from '@reduxjs/toolkit';
import { useDispatch, useSelector, TypedUseSelectorHook } from 'react-redux';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  persistStore,
  persistReducer,
  FLUSH,
  REHYDRATE,
  PAUSE,
  PERSIST,
  PURGE,
  REGISTER,
} from 'redux-persist';
import { combineReducers } from 'redux';

import authReducer from './slices/authSlice';
import interviewReducer from './slices/interviewSlice';
import resumeReducer from './slices/resumeSlice';

// ─── Root reducer ─────────────────────────────────────────────────────────────

const rootReducer = combineReducers({
  auth: authReducer,
  interview: interviewReducer,
  resume: resumeReducer,
});

// ─── Persist config — only auth is persisted ──────────────────────────────────

const persistConfig = {
  key: 'root',
  storage: AsyncStorage,
  whitelist: ['auth'], // interview & resume are always fresh on app start
};

const persistedReducer = persistReducer(persistConfig, rootReducer);

// ─── Store ────────────────────────────────────────────────────────────────────

export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // These redux-persist action types carry non-serializable data
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
      },
    }),
});

export const persistor = persistStore(store);

// ─── Types ────────────────────────────────────────────────────────────────────

export type RootState = ReturnType<typeof rootReducer>;
export type AppDispatch = typeof store.dispatch;

// ─── Typed hooks ─────────────────────────────────────────────────────────────

export const useAppDispatch = (): AppDispatch => useDispatch<AppDispatch>();
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
