import react = require('react');
import react_addons = require('react/addons');
import typed_react = require('typed-react');

import tsutil = require('../lib/base/tsutil');

export var CSSTransitionGroupF = react.createFactory(react_addons.addons.CSSTransitionGroup);

/** Merge props passed to a parent component with those set in a child
  * component.
  *
  * Props set in @p childProps override those set in @p parentProps with
  * the exception of 'className' where the value in @p parentProps and
  * the value in @p childProps are concatenated.
  */
export function mergeProps<P,C>(parentProps: P, childProps: C) : C {
	var childMap = tsutil.unsafeCast<C, {[index:string] : any}>(childProps);
	var parentMap = tsutil.unsafeCast<P, {[index:string] : any}>(parentProps);

	for (var k in parentMap) {
		if (!childMap.hasOwnProperty(k)) {
			childMap[k] = parentMap[k];
		} else if (k == 'className') {
			childMap[k] = childMap[k] + ' ' + parentMap[k];
		}
	}

	return childProps;
}

export function createFactory<P,S>(component: {new() : typed_react.Component<P,S>}) : react.Factory<P> {
	var factoryGenerator = (spec: react.Specification<P,S>) => {
		return react.createFactory(react.createClass(spec));
	};
	return typed_react.createFactory(factoryGenerator, component);
}

