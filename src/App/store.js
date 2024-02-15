import { createStore } from "redux";

const initialState = {
  playerPosition: { x: 0, y: 0 },
};

function gameReducer(state = initialState, action) {
  switch (action.type) {
    case "MOVE_PLAYER":
      const updatedPosition = action.payload;

      return { ...state, playerPosition: updatedPosition };
    default:
      return state;
  }
}

const store = createStore(gameReducer);

export default store;
