import Redux from 'redux'
import {SetProfileMetaAction} from '../actions/ActionTypes'
import {UserState} from './StateTypes'

const default_state: UserState = {
  loggedIn: false,
  id: null,
  displayName: null,
  image: null,
  email: null,
};

export function user(state: UserState = default_state, action: Redux.Action): UserState {
  switch(action.type) {
    case 'SET_PROFILE_META':
      let profile_action = (action as SetProfileMetaAction);
      return {
        loggedIn: profile_action.user.loggedIn,
        id: profile_action.user.id,
        displayName: profile_action.user.displayName,
        image: profile_action.user.image,
        email: profile_action.user.email,
      };
    default:
      return state;
  }
}
