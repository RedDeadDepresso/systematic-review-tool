import api from './axios';

/* ------------------ FETCH NOTES ------------------ */
export const fetchNotes = async (params: {
  reviewId: number;
  referenceId: number;
}) => {
  const res = await api.get('/notes/', {
    params: {
      review: params.reviewId,
      reference: params.referenceId,
    },
  });
  return res.data;
};

/* ------------------ CREATE NOTE ------------------ */
export const createNote = async (payload: {
  review: number;
  reference: number;
  content: string;
}) => {
  const res = await api.post('/notes/', payload);
  return res.data;
};

export const bulkCreateNote = async (payload: {
  referenceIds: number[];
  content: string;
}) => {
  const res = await api.post('/notes/bulk-create/', payload);
  return res.data;
};

/* ------------------ UPDATE NOTE ------------------ */
export const updateNote = async (
  noteId: number,
  payload: {
    content: string;
  }
) => {
  const res = await api.patch(`/notes/${noteId}/`, payload);
  return res.data;
};

/* ------------------ DELETE NOTE ------------------ */
export const deleteNote = async (noteId: number) => {
  const res = await api.delete(`/notes/${noteId}/`);
  return res.data;
};
