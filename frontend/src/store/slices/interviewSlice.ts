import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import {
  InterviewService,
  Interview,
  Question,
  CreateInterviewData,
} from '../../services/interviewService';

interface InterviewState {
  interviews: Interview[];
  currentInterview: Interview | null;
  questions: Question[];
  currentQuestionIndex: number;
  wsStatus: 'disconnected' | 'connecting' | 'connected' | 'error';
  isRecording: boolean;
  transcript: string;
  loading: boolean;
  error: string | null;
  sessionCompleted: boolean;
}

const initialState: InterviewState = {
  interviews: [],
  currentInterview: null,
  questions: [],
  currentQuestionIndex: 0,
  wsStatus: 'disconnected',
  isRecording: false,
  transcript: '',
  loading: false,
  error: null,
  sessionCompleted: false,
};

// ─── Thunks ──────────────────────────────────────────────────────────────────

export const fetchHistoryThunk = createAsyncThunk(
  'interview/fetchHistory',
  async (_, { rejectWithValue }) => {
    try {
      return await InterviewService.getHistory();
    } catch (e: any) {
      return rejectWithValue(e.response?.data?.detail || 'Failed to fetch history');
    }
  }
);

export const createInterviewThunk = createAsyncThunk(
  'interview/create',
  async (data: CreateInterviewData, { rejectWithValue }) => {
    try {
      return await InterviewService.createInterview(data);
    } catch (e: any) {
      return rejectWithValue(e.response?.data?.detail || 'Failed to create interview');
    }
  }
);

export const startInterviewThunk = createAsyncThunk(
  'interview/start',
  async (id: string, { rejectWithValue }) => {
    try {
      await InterviewService.startInterview(id);
      const questions = await InterviewService.getQuestions(id);
      return { id, questions };
    } catch (e: any) {
      return rejectWithValue(e.response?.data?.detail || 'Failed to start interview');
    }
  }
);

export const completeInterviewThunk = createAsyncThunk(
  'interview/complete',
  async (id: string, { rejectWithValue }) => {
    try {
      return await InterviewService.completeInterview(id);
    } catch (e: any) {
      return rejectWithValue(e.response?.data?.detail || 'Failed to complete interview');
    }
  }
);

// ─── Slice ────────────────────────────────────────────────────────────────────

const interviewSlice = createSlice({
  name: 'interview',
  initialState,
  reducers: {
    setCurrentInterview: (state, action: PayloadAction<Interview>) => {
      state.currentInterview = action.payload;
      state.currentQuestionIndex = 0;
      state.sessionCompleted = false;
      state.transcript = '';
    },
    setWsStatus: (
      state,
      action: PayloadAction<InterviewState['wsStatus']>
    ) => {
      state.wsStatus = action.payload;
    },
    setRecording: (state, action: PayloadAction<boolean>) => {
      state.isRecording = action.payload;
    },
    setTranscript: (state, action: PayloadAction<string>) => {
      state.transcript = action.payload;
    },
    nextQuestion: (state) => {
      if (state.currentQuestionIndex < state.questions.length - 1) {
        state.currentQuestionIndex += 1;
        state.transcript = '';
      } else {
        state.sessionCompleted = true;
      }
    },
    setSessionCompleted: (state, action: PayloadAction<boolean>) => {
      state.sessionCompleted = action.payload;
    },
    resetSession: (state) => {
      state.currentInterview = null;
      state.questions = [];
      state.currentQuestionIndex = 0;
      state.wsStatus = 'disconnected';
      state.isRecording = false;
      state.transcript = '';
      state.sessionCompleted = false;
      state.error = null;
    },
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    // ── Fetch History ───────────────────────────────────────────────────────
    builder.addCase(fetchHistoryThunk.pending, (state) => {
      state.loading = true;
      state.error = null;
    });
    builder.addCase(fetchHistoryThunk.fulfilled, (state, action) => {
      state.loading = false;
      state.interviews = action.payload;
    });
    builder.addCase(fetchHistoryThunk.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload as string;
    });

    // ── Create Interview ────────────────────────────────────────────────────
    builder.addCase(createInterviewThunk.pending, (state) => {
      state.loading = true;
      state.error = null;
    });
    builder.addCase(createInterviewThunk.fulfilled, (state, action) => {
      state.loading = false;
      state.interviews.unshift(action.payload);
      state.currentInterview = action.payload;
    });
    builder.addCase(createInterviewThunk.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload as string;
    });

    // ── Start Interview ─────────────────────────────────────────────────────
    builder.addCase(startInterviewThunk.pending, (state) => {
      state.loading = true;
      state.error = null;
    });
    builder.addCase(startInterviewThunk.fulfilled, (state, action) => {
      state.loading = false;
      state.questions = action.payload.questions;
      state.currentQuestionIndex = 0;
      state.transcript = '';
      state.sessionCompleted = false;
      // Update status of current interview in list
      const idx = state.interviews.findIndex((i) => i.id === action.payload.id);
      if (idx !== -1) state.interviews[idx].status = 'ACTIVE';
      if (state.currentInterview?.id === action.payload.id) {
        state.currentInterview.status = 'ACTIVE';
      }
    });
    builder.addCase(startInterviewThunk.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload as string;
    });

    // ── Complete Interview ──────────────────────────────────────────────────
    builder.addCase(completeInterviewThunk.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(completeInterviewThunk.fulfilled, (state) => {
      state.loading = false;
      state.sessionCompleted = true;
      if (state.currentInterview) {
        state.currentInterview.status = 'COMPLETED';
        const idx = state.interviews.findIndex(
          (i) => i.id === state.currentInterview?.id
        );
        if (idx !== -1) state.interviews[idx].status = 'COMPLETED';
      }
    });
    builder.addCase(completeInterviewThunk.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload as string;
    });
  },
});

export const {
  setCurrentInterview,
  setWsStatus,
  setRecording,
  setTranscript,
  nextQuestion,
  setSessionCompleted,
  resetSession,
  clearError,
} = interviewSlice.actions;

export default interviewSlice.reducer;
