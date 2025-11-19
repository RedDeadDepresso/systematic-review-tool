import api from './axios';

export const fetchNotes = async (reviewId: number, referenceId: number) => {
  const res = await api.get(
    `reviews/${reviewId}/references/${referenceId}/notes/`
  );
  return res.data;
};

export const createNote = async (
  reviewId: number,
  referenceId: number,
  data: {
    content: string;
  }
) => {
  const res = await api.post(
    `reviews/${reviewId}/references/${referenceId}/notes/`,
    data
  );
  return res.data;
};
