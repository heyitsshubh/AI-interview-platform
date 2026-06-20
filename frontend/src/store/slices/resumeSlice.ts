import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { ResumeService, Resume } from '../../services/resumeService';

interface ResumeState {
  resumes: Resume[];
  uploadStatus: 'idle' | 'uploading' | 'success' | 'error';
  loading: boolean;
  error: string | null;
}

const initialState: ResumeState = {
  resumes: [],
  uploadStatus: 'idle',
  loading: false,
  error: null,
};

// ─── Thunks ──────────────────────────────────────────────────────────────────

export const fetchResumesThunk = createAsyncThunk(
  'resume/fetchAll',
  async (_, { rejectWithValue }) => {
    try {
      return await ResumeService.getMyResumes();
    } catch (e: any) {
      return rejectWithValue(e.response?.data?.detail || 'Failed to fetch resumes');
    }
  }
);

export const uploadResumeThunk = createAsyncThunk(
  'resume/upload',
  async (
    { fileUri, filename }: { fileUri: string; filename: string },
    { rejectWithValue }
  ) => {
    try {
      return await ResumeService.uploadResume(fileUri, filename);
    } catch (e: any) {
      return rejectWithValue(e.response?.data?.detail || 'Upload failed');
    }
  }
);

export const deleteResumeThunk = createAsyncThunk(
  'resume/delete',
  async (id: string, { rejectWithValue }) => {
    try {
      await ResumeService.deleteResume(id);
      return id;
    } catch (e: any) {
      return rejectWithValue(e.response?.data?.detail || 'Failed to delete resume');
    }
  }
);

// ─── Slice ────────────────────────────────────────────────────────────────────

const resumeSlice = createSlice({
  name: 'resume',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    resetUploadStatus: (state) => {
      state.uploadStatus = 'idle';
    },
  },
  extraReducers: (builder) => {
    // ── Fetch All ───────────────────────────────────────────────────────────
    builder.addCase(fetchResumesThunk.pending, (state) => {
      state.loading = true;
      state.error = null;
    });
    builder.addCase(fetchResumesThunk.fulfilled, (state, action) => {
      state.loading = false;
      state.resumes = action.payload;
    });
    builder.addCase(fetchResumesThunk.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload as string;
    });

    // ── Upload ──────────────────────────────────────────────────────────────
    builder.addCase(uploadResumeThunk.pending, (state) => {
      state.uploadStatus = 'uploading';
      state.error = null;
    });
    builder.addCase(uploadResumeThunk.fulfilled, (state, action) => {
      state.uploadStatus = 'success';
      state.resumes.unshift(action.payload);
    });
    builder.addCase(uploadResumeThunk.rejected, (state, action) => {
      state.uploadStatus = 'error';
      state.error = action.payload as string;
    });

    // ── Delete ──────────────────────────────────────────────────────────────
    builder.addCase(deleteResumeThunk.fulfilled, (state, action) => {
      state.resumes = state.resumes.filter((r) => r.id !== action.payload);
    });
    builder.addCase(deleteResumeThunk.rejected, (state, action) => {
      state.error = action.payload as string;
    });
  },
});

export const { clearError, resetUploadStatus } = resumeSlice.actions;
export default resumeSlice.reducer;
