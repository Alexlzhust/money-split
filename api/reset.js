import { handleApiError, resetState, sendJson } from './_database.js';

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    return sendJson(response, 405, { error: 'Method not allowed.' });
  }

  try {
    return sendJson(response, 200, await resetState());
  } catch (error) {
    return handleApiError(response, error);
  }
}
