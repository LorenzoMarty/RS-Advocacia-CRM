function errorMsg(error) {
  return error instanceof Error ? error.message : 'Falha ao comunicar com a API.';
}

/**
 * Generic save (create or update) with flash feedback.
 *
 * @param {object} opts
 * @param {string|undefined} opts.id         Entity id; truthy = update, falsy = create
 * @param {() => Promise} opts.createFn      API call for create
 * @param {(id: string) => Promise} opts.updateFn  API call for update
 * @param {(response: any) => any} opts.fromResponse  Maps API response to store shape
 * @param {(saved: any) => void} opts.onSuccess  Updates local state with saved entity
 * @param {Function} opts.addFlash           Store addFlash function
 * @param {string|null} opts.createMsg       Toast on create (null = silent)
 * @param {string|null} opts.updateMsg       Toast on update (null = silent)
 * @returns {Promise<any|null>}
 */
export async function saveEntity({ id, createFn, updateFn, fromResponse, onSuccess, addFlash, createMsg, updateMsg }) {
  try {
    const response = id ? await updateFn(id) : await createFn();
    const saved = fromResponse(response);
    if (!saved) {
      throw new Error('Resposta inválida da API.');
    }
    onSuccess(saved);
    const msg = id ? updateMsg : createMsg;
    if (msg) {
      addFlash(msg, 'success');
    }
    return saved;
  } catch (error) {
    addFlash(errorMsg(error), 'error');
    return null;
  }
}

/**
 * Generic delete with flash feedback.
 *
 * @param {object} opts
 * @param {() => Promise} opts.deleteFn      API call to delete
 * @param {() => void} opts.onSuccess        Updates local state after deletion
 * @param {Function} opts.addFlash           Store addFlash function
 * @param {string} opts.successMsg           Toast on success
 * @returns {Promise<boolean>}
 */
export async function deleteEntity({ deleteFn, onSuccess, addFlash, successMsg }) {
  try {
    await deleteFn();
  } catch (error) {
    addFlash(errorMsg(error), 'error');
    return false;
  }
  onSuccess();
  addFlash(successMsg, 'success');
  return true;
}
