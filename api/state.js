import { handleApiError, readState, sendJson } from './_database.js';

export default async function handler(request, response) {
  if (request.method !== 'GET') {
    return sendJson(response, 405, { error: 'Method not allowed.' });
  }

  try {
    return sendJson(response, 200, await readState());
  } catch (error) {
    return handleApiError(response, error);
  }
}
