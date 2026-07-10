import {
  addTransaction,
  deleteTransaction,
  handleApiError,
  readBody,
  sendJson,
  updateTransaction
} from './_database.js';

export default async function handler(request, response) {
  if (!['POST', 'PUT', 'DELETE'].includes(request.method)) {
    return sendJson(response, 405, { error: 'Method not allowed.' });
  }

  try {
    const body = await readBody(request);
    if (request.method === 'POST') {
      return sendJson(response, 200, await addTransaction(body.transaction));
    }
    if (request.method === 'PUT') {
      return sendJson(response, 200, await updateTransaction(body.transaction));
    }
    return sendJson(response, 200, await deleteTransaction(body.id));
  } catch (error) {
    return handleApiError(response, error);
  }
}
