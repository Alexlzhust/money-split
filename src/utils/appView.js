export const APP_SCREENS = {
  LEDGER: 'ledger',
  SETTLEMENT: 'settlement',
  TRANSACTION: 'transaction'
};

export function createInitialAppView() {
  return {
    screen: APP_SCREENS.LEDGER,
    editingTransaction: null,
    repaymentPreset: null,
    memberOpen: false
  };
}

export function appViewReducer(state, action) {
  switch (action.type) {
    case 'OPEN_LEDGER':
      return {
        ...state,
        screen: APP_SCREENS.LEDGER,
        editingTransaction: null,
        repaymentPreset: null
      };
    case 'OPEN_SETTLEMENT':
      return {
        ...state,
        screen: APP_SCREENS.SETTLEMENT,
        editingTransaction: null,
        repaymentPreset: null,
        memberOpen: false
      };
    case 'OPEN_NEW_TRANSACTION':
      return {
        screen: APP_SCREENS.TRANSACTION,
        editingTransaction: null,
        repaymentPreset: null,
        memberOpen: false
      };
    case 'OPEN_REPAYMENT_TRANSACTION':
      return {
        screen: APP_SCREENS.TRANSACTION,
        editingTransaction: null,
        repaymentPreset: action.repaymentPreset,
        memberOpen: false
      };
    case 'OPEN_EDIT_TRANSACTION':
      return {
        screen: APP_SCREENS.TRANSACTION,
        editingTransaction: action.transaction,
        repaymentPreset: null,
        memberOpen: false
      };
    case 'CLOSE_TRANSACTION':
      return {
        ...state,
        screen: APP_SCREENS.LEDGER,
        editingTransaction: null,
        repaymentPreset: null,
        memberOpen: false
      };
    case 'OPEN_MEMBERS':
      return state.screen === APP_SCREENS.LEDGER ? { ...state, memberOpen: true } : state;
    case 'CLOSE_MEMBERS':
      return { ...state, memberOpen: false };
    default:
      return state;
  }
}
