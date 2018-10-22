/**
 * External dependencies
 */
import { overSome, includes, first, last, pick, mapValues, drop, dropRight } from 'lodash';
import { getBlockType } from '@wordpress/blocks';

/**
 * Default options for withHistory reducer enhancer. Refer to withHistory
 * documentation for options explanation.
 *
 * @see withHistory
 *
 * @type {Object}
 */
const DEFAULT_OPTIONS = {
	resetTypes: [],
	ignoreTypes: [],
	shouldOverwriteState: () => false,
};

/**
 * Higher-order reducer creator which transforms the result of the original
 * reducer into an object tracking its own history (past, present, future).
 *
 * @param {?Object}   options                      Optional options.
 * @param {?Array}    options.resetTypes           Action types upon which to
 *                                                 clear past.
 * @param {?Array}    options.ignoreTypes          Action types upon which to
 *                                                 avoid history tracking.
 * @param {?Function} options.shouldOverwriteState Function receiving last and
 *                                                 current actions, returning
 *                                                 boolean indicating whether
 *                                                 present should be merged,
 *                                                 rather than add undo level.
 *
 * @return {Function} Higher-order reducer.
 */
const withHistory = ( options = {} ) => ( reducer ) => {
	options = { ...DEFAULT_OPTIONS, ...options };

	// `ignoreTypes` is simply a convenience for `shouldOverwriteState`
	options.shouldOverwriteState = overSome( [
		options.shouldOverwriteState,
		( action ) => includes( options.ignoreTypes, action.type ),
	] );

	const initialState = {
		past: [],
		present: reducer( undefined, {} ),
		future: [],
		lastAction: null,
		shouldCreateUndoLevel: false,
	};

	const {
		resetTypes = [],
		shouldOverwriteState = () => false,
	} = options;

	return ( state = initialState, action ) => {
		const { past, present, future, lastAction, shouldCreateUndoLevel } = state;
		const previousAction = lastAction;

		switch ( action.type ) {
			case 'UNDO':
				// Can't undo if no past.
				if ( ! past.length ) {
					return state;
				}

				return {
					past: dropRight( past ),
					present: last( past ),
					future: [ present, ...future ],
					lastAction: null,
					shouldCreateUndoLevel: false,
				};
			case 'REDO':
				// Can't redo if no future.
				if ( ! future.length ) {
					return state;
				}

				return {
					past: [ ...past, present ],
					present: first( future ),
					future: drop( future ),
					lastAction: null,
					shouldCreateUndoLevel: false,
				};

			case 'CREATE_UNDO_LEVEL':
				return {
					...state,
					lastAction: null,
					shouldCreateUndoLevel: true,
				};
		}

		const nextPresent = reducer( present, action );

		if ( includes( resetTypes, action.type ) ) {
			return {
				past: [],
				present: nextPresent,
				future: [],
				lastAction: null,
				shouldCreateUndoLevel: false,
			};
		}

		if ( present === nextPresent ) {
			return state;
		}

		let nextPast = past;

		if (
			shouldCreateUndoLevel ||
			! past.length ||
			! shouldOverwriteState( action, previousAction )
		) {
			nextPast = [ ...past, sanitize( present ) ];
		}

		return {
			past: nextPast,
			present: nextPresent,
			future: [],
			shouldCreateUndoLevel: false,
			lastAction: action,
		};
	};
};

function sanitize( state ) {
	return {
		...state,
		blocksByClientId: mapValues( state.blocksByClientId, ( block ) => {
			const blockType = getBlockType( block.name );
			const attributeKeys = Object.keys( blockType.attributes );
			return {
				...block,
				attributes: pick( block.attributes, attributeKeys ),
			};
		} ),
	};
}

export default withHistory;
