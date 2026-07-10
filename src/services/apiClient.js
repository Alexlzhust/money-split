async function requestJson(path, options = {}) {
  const response = await fetch(path, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    },
    ...options
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.error || `Request failed: ${response.status}`);
  }

  return payload;
}

export function fetchRemoteState() {
  return requestJson('/api/state');
}

export function createRemoteMember(name) {
  return requestJson('/api/members', {
    method: 'POST',
    body: JSON.stringify({ name })
  });
}

export function createRemoteTransaction(transaction) {
  return requestJson('/api/transactions', {
    method: 'POST',
    body: JSON.stringify({ transaction })
  });
}

export function updateRemoteTransaction(transaction) {
  return requestJson('/api/transactions', {
    method: 'PUT',
    body: JSON.stringify({ transaction })
  });
}

export function deleteRemoteTransaction(id) {
  return requestJson('/api/transactions', {
    method: 'DELETE',
    body: JSON.stringify({ id })
  });
}

export function resetRemoteState() {
  return requestJson('/api/reset', {
    method: 'POST'
  });
}
