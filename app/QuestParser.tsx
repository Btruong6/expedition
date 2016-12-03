/* Parses quest syntax and traverses it as a player would.
   Returns objects of the type:
   {'type', 'icon', 'title', 'contents'}
   where all arguments except 'type' are optional.
   See quests/quest_spec.txt for specification.
*/
/// <reference path="../typings/react/react-dom.d.ts" />
/*global math */
import * as React from 'react'
import {XMLElement, DOMElement} from './reducers/StateTypes'
import {QuestCardName, Enemy, Choice} from './reducers/QuestTypes'
import {encounters} from './Encounters'

var htmlDecode = (require('he') as any).decode;

var math = require('mathjs') as any;

export interface QuestContext {
  scope: any; //TODO: required fields later
}

export interface TriggerResult {
  node: XMLElement;
  name: string;
}

export interface RoleplayResult {
  icon: string;
  title: string;
  content: JSX.Element;
  instruction?: JSX.Element;
  choices: Choice[];
  context: QuestContext;
}

export interface CombatResult {
  icon: string;
  enemies: Enemy[];
}

export function validate(root: XMLElement) {
  if (root === undefined) {
    throw new Error("Quest has invalid root node");
  }

  var badEntries = _getInvalidNodesAndAttributes(root);
  if (!_isEmptyObject(badEntries)) {
    throw new Error("Found invalid nodes and attributes: " + JSON.stringify(badEntries));
  }

  var duplicateIDs = _getDuplicateIds(root);
  if (!_isEmptyObject(duplicateIDs)) {
    throw new Error("Found nodes with duplicate ids: " + JSON.stringify(duplicateIDs));
  }
};

export function init(root: XMLElement): XMLElement {
  return _loadNode(root.children().eq(0));
}

// The passed event parameter is a string indicating which event to fire based on the "on" attribute.
export function handleEvent(parent: XMLElement, event: string, context: QuestContext): XMLElement {
  var child = _loopChildren(parent, function(tag: string, c: XMLElement) {
    if (c.attr('on') === event && _isEnabled(c, context)) {
      return c;
    }
  }.bind(this));

  if (!child) {
    throw new Error("Could not find child with on='"+event+"'");
  }
  return _loadNode(child);
};

// The passed choice parameter is an number indicating the choice number in the XML element, including conditional choices.
export function handleChoice(parent: XMLElement, choice: number): XMLElement {

  // Scan the parent node to find the choice with the right number
  var idx = 0;
  var choiceIdx = -1;
  for (; idx < parent.children().length; idx++) {
    if (parent.children().get(idx).tagName.toLowerCase() === "choice") {
      choiceIdx++;
    }

    // When we find our choice, push it onto the stack and load it.
    if (choiceIdx === choice) {
      return _loadNode(parent.children().eq(idx));
    }
  }

  // This happens on lookup error or default "Next"/"End" event
  if (_loopChildren(parent, function(tag) { if (tag === "end") { return true; }})) {
    return null;
  }
  return _loadNode(_findNextNode(parent));
};

export function getNodeCardType(node: XMLElement): QuestCardName {
  switch(node.get(0).tagName.toLowerCase()) {
    case 'roleplay':
      return 'ROLEPLAY';
    case 'combat':
      return 'COMBAT';
    default:
      console.log("Could not get node card type for node " + node.get(0).tagName);
      return null;
  }
}

function _loadNode(node: XMLElement): XMLElement {
  switch(node.get(0).tagName.toLowerCase()) {
    //case "op":
    // return _loadOpNode(node);
    case 'choice':
      return _loadChoiceNode(node);
    case 'event':
      return _loadEventNode(node);
    case 'combat':
      return node;
    case 'roleplay':
      return node;
    case 'trigger':
      return node;
    case 'comment':
      return _loadNode(_findNextNode(node));
    default:
      throw new Error('Unknown node name: ' + node.get(0).tagName);
  }
};

function _loadChoiceNode(node: XMLElement): XMLElement {
  // The action on a choice node is functionally the same as an event node.
  return _loadEventNode(node);
};

function _loadEventNode(node: XMLElement): XMLElement {
  // If event is empty and has a goto, jump to the destination element with that id.
  if (node.children().length === 0 && node.attr('goto')) {
    return _loadNode(_findRootNode(node).find('#'+node.attr('goto')).eq(0));
  }

  // Validate the event node (must not have an event child and must control something)
  var hasControlChild = false;
  _loopChildren(node, function(tag) {
    if (tag === 'event' || tag === 'choice') {
      throw new Error('Node cannot have <event> or <choice> child');
    }

    if (tag === 'combat' || tag === 'trigger' || tag === 'roleplay') {
      hasControlChild = true;
    }
  });
  if (!hasControlChild) {
    throw new Error('Node without goto attribute must have at least one of <combat> or <roleplay>');
  }

  // Dive in to the first element.
  return _loadNode(node.children().eq(0));
};

export function loadCombatNode(node: XMLElement, context: QuestContext): CombatResult {
  var enemies: Enemy[] = [];

  var newScope = Object.assign({}, context.scope);

  // Track win and lose events for validation
  var winEventCount = 0;
  var loseEventCount = 0;
  _loopChildren(node, function(tag: string, c: XMLElement) {

    // Skip events and enemies that aren't enabled.
    if (!_isEnabled(c, newScope)) {
      return;
    }

    switch (tag) {
      case 'e':
        var text = c.text();

        // Replace text if it's an op string.
        // If the string fails to evaluate, the
        // original op is returned as text.
        var op = parseOpString(text);
        if (op) {
          var evalResult = evaluateOp(op, newScope);
          if (evalResult) {
            text = evalResult + '';
          }
        }

        if (!encounters[text]) {
          // If we don't know about the enemy, just assume tier 1.
          enemies.push({name: text, tier: 1});
        } else {
          enemies.push({name: text, tier: encounters[text].tier});
        }
        break;
      case 'event':
        winEventCount += (c.attr('on') === 'win' && _isEnabled(c, newScope)) ? 1 : 0;
        loseEventCount += (c.attr('on') === 'lose' && _isEnabled(c, newScope)) ? 1 : 0;
        break;
      default:
        throw new Error('Invalid child element: ' + tag);
    }
  }.bind(this));

  if (winEventCount === 0) {
    throw new Error("<combat> must have at least one conditionally true child with on='win'");
  }

  if (loseEventCount === 0) {
    throw new Error("<combat> must have at least one conditionally true child with on='lose'");
  }

  if (!enemies.length) {
    throw new Error("<combat> has no <e> children");
  }

  // Combat is stateless, so newScope is not returned here.
  return {
    icon: node.attr('icon'),
    enemies,
  };
};

export function loadTriggerNode(node: XMLElement): TriggerResult {
  return {
    node,
    name: node.text()
  };
};

function _isComment(node: XMLElement): boolean {
  return (node.get(0).tagName.toLowerCase() === "comment");
}

function _isEnabled(node: XMLElement, context: QuestContext): boolean {
  // Comments are never visible.
  if (_isComment(node)) {
    return false;
  }

  var ifExpr = node.attr('if');
  if (!ifExpr) {
    return true;
  }

  // Operate on a copied context - checking for enablement should never
  // change the current context.
  var tmpContext = Object.assign({}, context);
  try {
    var visible = math.eval(ifExpr, tmpContext);

    // We check for truthiness here, so nonzero numbers are true, etc.
    return Boolean(visible);
  } catch (e) {
    // If we fail to evaluate (e.g. symbol not defined), treat the node as not visible.
    return false;
  }
};

function _xmlToJSX(node: XMLElement): JSX.Element {
  return ((node as any) as JSX.Element)
}

function lastExpressionAssignsValue(parsed: any): boolean {
  if (parsed.type === 'BlockNode') {
    return lastExpressionAssignsValue(parsed.blocks[parsed.blocks.length-1].node);
  }
  return (parsed.type === 'AssignmentNode' || parsed.type === 'FunctionAssignmentNode');
}

function parseOpString(str: string): string {
  var op = str.match(/{{([\s\S]+?)}}/);
  if (!op) {
    return null;
  }
  return op[1];
}

function evaluateOp(op: string, scope: any): any {
  // If it's an operation, run it with our context.
  var parsed = math.parse(htmlDecode(op));

  try {
    var evalResult = parsed.compile().eval(scope);
  } catch(e) {
    return null;
  }

  // Only add the result to content IF it doesn't assign a value as its last action.
  if (!lastExpressionAssignsValue(parsed)) {

    // If ResultSet, then unwrap it and get the last value.
    // http://mathjs.org/docs/reference/classes/resultset.html
    if (parsed.type === 'BlockNode') {
      var v = evalResult.valueOf();
      evalResult = v[v.length-1];
    }

    if (evalResult.length === 1) {
      // If we're a single-valued array, so unwrap the value.
      evalResult = evalResult[0];
    } else if (evalResult.size) {
      // We have a single-valued matrix result, so unwrap the value.
      // http://mathjs.org/docs/datatypes/matrices.html
      var size = evalResult.size();
      if (size.length === 1 && size[0] === 1) {
        evalResult = evalResult.get([0]);
      }
    }
    return evalResult;
  }
}

function evaluateContentOps(content: string, scope: any): string {
  // Run MathJS over all detected {{operations}}:
  //
  // {{.+?(?=}})}}       Match "{{asdf\n1234}}"
  // |                   Or
  // .+?(?={{|$)         Nongreedy characters (including whitespace) until "{{" or end of string
  // /g                  Multiple times
  var matches = content.match(/{{[\s\S]+?(?=}})}}|[\s\S]+?(?={{|$)/g);

  var result = "";
  for (let m of matches) {
    var op = parseOpString(m);
    if (op) {
      var evalResult = evaluateOp(op, scope);
      if (evalResult) {
        result += evalResult;
      }
    } else {
      result += m;
    }
  }

  // Don't return lines that parsed into nothing
  if (content !== result && result === '<p></p>') {
    return '';
  }
  return result;
}

export function loadRoleplayNode(node: XMLElement, context: QuestContext): RoleplayResult {
  // Append elements to contents
  var numEvents = 0;
  var child: XMLElement;
  var choices: Choice[] = [];
  var children: string = '';
  var instruction: JSX.Element = null;

  var newScope = Object.assign({}, context.scope);

  // Keep track of the number of choice nodes seen, so we can
  // select a choice without worrying about the state of the quest scope.
  var idx = -1;

  _loopChildren(node, function(tag: string, c: XMLElement) {
    c = c.clone();
    if (tag === "choice") {
      idx++;
    }

    // Skip elements that aren't visible
    if (!_isEnabled(c, newScope)) {
      return;
    }

    // Accumulate "choice" tags in choices[]
    if (tag === "choice") {
      if (!c.attr('text')) {
        throw new Error("<choice> inside <roleplay> must have 'text' attribute");
      }
      var text = c.attr('text');
      choices.push({text, idx});
      numEvents++;
      return;
    }

    if (tag === "event") {
      throw new Error("<roleplay> cannot contain <event>.");
    }

    // Convert "instruction" tags to <indicator> tags.
    if (tag === "instruction") {
      instruction = <span dangerouslySetInnerHTML={{__html: c.html()}} />;
      return;
    }

    // If we received a Cheerio object, outerHTML will
    // not be defined. toString will be, however.
    // https://github.com/cheeriojs/cheerio/issues/54
    var textContent = '';
    if (c.get(0).outerHTML) {
      textContent = c.get(0).outerHTML;
    } else if (c.toString) {
      textContent = c.toString();
    } else {
      throw new Error("Invalid element " + c);
    }
    children += evaluateContentOps(textContent, newScope);
  }.bind(this));

  // Append a generic "Next" button if there were no events,
  // or an "End" button if there's also an <End> tag.
  if (numEvents === 0) {
    // Handle custom generic next button text based on if we're heading into a trigger node.
    var nextNode = _findNextNode(node);
    var buttonText = "Next";
    if (nextNode && nextNode.get(0).tagName.toLowerCase() === "trigger") {
      switch(nextNode.text().toLowerCase()) {
        case "end":
          buttonText = "End";
          break;
        default:
          throw new Error("Unknown trigger content " + nextNode.text());
      }
    }
    choices.push({text: buttonText, idx: 0});
  }

  return {
    title: node.attr('title'),
    icon: node.attr('icon'),
    content: <span dangerouslySetInnerHTML={{__html: children}} />,
    choices,
    instruction,
    context: {scope: newScope},
  };
};

function _isControlNode(node: XMLElement) {
  var tagName = node.get(0).tagName.toLowerCase();
  return tagName === "choice" || tagName === "event" || node.attr('on');
};

function _findRootNode(node: XMLElement) {
  while(node !== null && node.get(0).tagName.toLowerCase() !== "quest") {
    node = node.parent();
  }
  return node;
}

function _findNextNode(node: XMLElement) {
  while (true) {
    if (node.length === 0) {
      return null;
    }

    var sibling = node.next();


    // Skip control elements
    if (sibling !== null && sibling.length > 0 && !_isControlNode(sibling)) {
      return sibling;
    }

    // Continue searching neighbors if we have neighbors, otherwise
    // search in the parent node.
    if (sibling !== null && sibling.length > 0) {
      node = sibling;
    } else {
      node = node.parent();
    }
  }
};

function _loopChildren(node: XMLElement, cb: (tag: string, c: XMLElement)=>any) {
  for (var i = 0; i < node.children().length; i++) {
    var v = cb(node.children().get(i).tagName.toLowerCase(), node.children().eq(i));
    if (v !== undefined) {
      return v;
    }
  }
};

// Validate this node and all children for invalid tags.
// Returns a map of tagName->count of the invalid elements found.
function _getInvalidNodesAndAttributes(node: XMLElement) {
  var results: any = {};

  // Quests must only contain these tags:
  if (["op", "quest", "div", "span", "b", "i", "choice", "event", "combat", "roleplay", "p", "e", "em",
       "trigger", "comment", "instruction"].indexOf(
        node.get(0).tagName.toLowerCase()) === -1) {
    results[node.get(0).tagName.toLowerCase()] = (results[node.get(0).tagName.toLowerCase()] || 0) + 1;
  }

  var attribNames = Object.keys(node.attribs);
  for (var i = 0; i < attribNames.length; i++) {
    // All HTML event handlers are prefixed with 'on'.
    // See http://www.w3schools.com/tags/ref_eventattributes.asp
    // We use just 'on' without any extras, which is not used by HTML for event handling.
    if (attribNames[i].indexOf('on') === 0 && attribNames[i] !== "on") {
      var k = node.get(0).tagName.toLowerCase() + '.' + attribNames[i];
      results[k] = (results[k] || 0) + 1;
    }
  }

  var mergeResults = function(k: string): void {
    results[k] = (results[k] || 0) + this[k];
  };
  for (i = 0; i < node.children().length; i++) {
    var v = _getInvalidNodesAndAttributes(node.children().eq(i));
    Object.keys(v).forEach(mergeResults.bind(v));
  }
  return results;
};

// Validate this node and all children for duplicate IDs.
// Returns a map of id->[element] of all duplicate elements with the same IDs.
function _getDuplicateIds(node: XMLElement): { [key:string]:string[]; } {
  var map = _generateIdMapping(node);

  var results: { [key:string]:string[]; } = {};
  Object.keys(map).forEach(function(k: string) {
    if (map[k].length > 1) {
      results[k] = map[k];
    }
  });

  return results;
};

// Builds and returns a map of all IDs to all nodes with that ID.
function _generateIdMapping(node: XMLElement): { [key:string]:string[]; } {
  var map: { [key:string]:string[]; } = {};
  if (node.attr("id")) {
    var id = node.attr("id");
    map[id] = (map[id] || []).concat([node.get(0).tagName.toLowerCase()]);
  }

  var mergeResults = function(k: any) {
    map[k] = (map[k] || []).concat(this[k]);
  };
  for (var i = 0; i < node.children().length; i++) {
    var m = _generateIdMapping(node.children().eq(i));
    Object.keys(m).forEach(mergeResults.bind(m));
  }
  return map;
};

function _isEmptyObject(obj: Object) {
  return Object.keys(obj).length === 0 && JSON.stringify(obj) === JSON.stringify({});
};
