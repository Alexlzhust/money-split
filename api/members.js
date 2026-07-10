import { addMember, handleApiError, readBody, sendJson } from './_database.js';

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    return sendJson(response, 405, { error: 'Method not allowed.' });
  }

  try {
    const body = await readBody(request);
    return sendJson(response, 200, await addMember(body.name));
  } catch (error) {
    return handleApiError(response, error);
  }
}
