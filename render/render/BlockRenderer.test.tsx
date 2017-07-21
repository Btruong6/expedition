import {Block} from '../block/BlockList'
import {BlockRenderer} from './BlockRenderer'
import {XMLRenderer} from './XMLRenderer'
import {Logger, prettifyMsgs} from '../Logger'
import TestData from './TestData'

var prettifyHTML = (require('html') as any).prettyPrint;

var expect: any = require('expect');
var cheerio: any = require('cheerio') as CheerioAPI;



describe('BlockRenderer', () => {
  // BlockRenderer is stateless
  var br = new BlockRenderer(XMLRenderer);

  describe('toCombat', () => {
    it('errors on bad parsing', () => {
      var log = new Logger();
      var blocks: Block[] = [
        {
          indent: 0,
          lines: ['ha! this will never parse'],
          startLine: 0,
        }
      ];

      br.toCombat(blocks, log)

      expect(prettifyHTML(blocks[0].render + '')).toEqual(TestData.genericCombatXML);
      expect(prettifyMsgs(log.finalize())).toEqual(TestData.combatBadParseLog);
    });

     it('errors on bad bullet json', () => {
      var log = new Logger();
      var blocks: Block[] = [
        {
          indent: 0,
          lines: ['_combat_', '', '- e1', '* on win {invalid_json}'],
          startLine: 0,
        },
        {
          indent: 2,
          lines: [],
          render: XMLRenderer.toRoleplay({}, ['win'], null),
          startLine: 2,
        },
        {
          indent: 0,
          lines: ['* on lose'],
          startLine: 4,
        },
        {
          indent: 2,
          lines: [],
          render: XMLRenderer.toRoleplay({}, ['lose'], null),
          startLine: 2,
        },
      ];

      br.toCombat(blocks, log)

      expect(prettifyHTML(blocks[0].render + '')).toEqual(TestData.badJSONXML);
      expect(prettifyMsgs(log.finalize())).toEqual(TestData.badJSONLog);
    });

    it ('errors without enemies or events', () => {
      var log = new Logger();
      var blocks: Block[] = [
        {
          indent: 0,
          lines: ['_combat_'],
          startLine: 0,
        }
      ];

      br.toCombat(blocks, log)

      expect(prettifyHTML(blocks[0].render + '')).toEqual(TestData.genericCombatXML);
      expect(prettifyMsgs(log.finalize())).toEqual(TestData.combatNoEnemyOrEventsLog);
    })

    it ('errors with bad enemy tier', () => {
      var log = new Logger();
      var blocks: Block[] = [
        {
          indent: 0,
          lines: ['_combat_', '', '- Thief {"tier": -1}', '- Thief', '', '* on win'],
          startLine: 0,
        },
        {
          indent: 2,
          lines: [],
          render: XMLRenderer.toRoleplay({}, ['win'], null),
          startLine: 2,
        },
        {
          indent: 0,
          lines: ['* on lose'],
          startLine: 4,
        },
        {
          indent: 2,
          lines: [],
          render: XMLRenderer.toRoleplay({}, ['lose'], null),
          startLine: 2,
        },
      ];

      br.toCombat(blocks, log)
      expect(prettifyMsgs(log.finalize())).toEqual(TestData.combatBadTierLog);
    })

    it('errors on inner block without event bullet');

    it('renders full combat', () => {
      var log = new Logger();
      var blocks: Block[] = [
        {
          indent: 0,
          lines: ['_combat_', '', '- e1', '- e2 {"tier": 3}', '* on win'],
          startLine: 0,
        },
        {
          indent: 2,
          lines: [],
          render: XMLRenderer.toRoleplay({}, ['win'], null),
          startLine: 2,
        },
        {
          indent: 0,
          lines: ['* on lose'],
          startLine: 4,
        },
        {
          indent: 2,
          lines: [],
          render: XMLRenderer.toRoleplay({}, ['lose'], null),
          startLine: 2,
        },
      ];

      br.toCombat(blocks, log)
      expect(prettifyHTML(blocks[0].render + '')).toEqual(TestData.fullCombatXML);
      expect(prettifyMsgs(log.finalize())).toEqual('');
    });

    it('renders conditional events', () => {
      var log = new Logger();
      var blocks: Block[] = [
        {
          indent: 0,
          lines: ['_combat_', '', '- e1', '- e2', '* {{test1}} on win'],
          startLine: 0,
        },
        {
          indent: 2,
          lines: [],
          render: XMLRenderer.toRoleplay({}, ['win'], null),
          startLine: 2,
        },
        {
          indent: 0,
          lines: ['* {{test2}} on lose'],
          startLine: 4,
        },
        {
          indent: 2,
          lines: [],
          render: XMLRenderer.toRoleplay({}, ['lose'], null),
          startLine: 2,
        },
      ];

      br.toCombat(blocks, log)

      expect(prettifyHTML(blocks[0].render + '')).toEqual(TestData.combatConditionalEventXML);
      expect(prettifyMsgs(log.finalize())).toEqual('');
    });

    it('renders with JSON', () => {
      var log = new Logger();
      var blocks: Block[] = [
        {
          indent: 0,
          lines: ['_combat_ {"enemies": [{"text":"skeleton"}, {"text":"test", "visible":"cond"}]}', '', '* {{test1}} on win {"heal": 2}'],
          startLine: 0,
        },
        {
          indent: 2,
          lines: [],
          render: XMLRenderer.toRoleplay({}, ['win'], null),
          startLine: 2,
        },
        {
          indent: 0,
          lines: ['* {{test2}} on lose'],
          startLine: 4,
        },
        {
          indent: 2,
          lines: [],
          render: XMLRenderer.toRoleplay({}, ['lose'], null),
          startLine: 2,
        },
      ];

      br.toCombat(blocks, log)

      expect(prettifyHTML(blocks[0].render + '')).toEqual(TestData.combatJSONEnemyXML);
      expect(prettifyMsgs(log.finalize())).toEqual('');
    });

    it('errors if inner combat block with no event bullet');

    it('errors if invalid combat event');

    it('errors if invalid combat enemy');
  });

  describe('toRoleplay', () => {
    it('renders full roleplay', () => {
      var log = new Logger();
      var blocks: Block[] = [
        {
          indent: 0,
          lines: ['_roleplay_', '', 'text', '', '* choice'],
          startLine: 0,
        },
        {
          indent: 2,
          lines: [],
          render: XMLRenderer.toRoleplay({}, ['choice text'], null),
          startLine: 2,
        },
        {
          indent: 0,
          lines: ['* other choice'],
          startLine: 4,
        },
        {
          indent: 2,
          lines: [],
          render: XMLRenderer.toRoleplay({}, ['other choice text'], null),
          startLine: 2,
        },
      ];

      br.toRoleplay(blocks, log)

      expect(prettifyHTML(blocks[0].render + '')).toEqual(TestData.fullRoleplayXML);
      expect(prettifyMsgs(log.finalize())).toEqual('');
    });

    it('renders roleplay without title', () => {
      var log = new Logger();
      var blocks: Block[] = [
        { lines: [ 'Victory!', '' ],
          indent: 4,
          startLine: 21
        }
      ];

      br.toRoleplay(blocks, log)

      expect(prettifyHTML(blocks[0].render + '')).toEqual(TestData.roleplayNoTitle);
      expect(prettifyMsgs(log.finalize())).toEqual('');
    });

    it('renders conditional choices', () => {
      var log = new Logger();
      var blocks: Block[] = [
        {
          indent: 0,
          lines: ['_roleplay_', '', 'text', '', '* {{test1}} choice'],
          startLine: 0,
        },
        {
          indent: 2,
          lines: [],
          render: XMLRenderer.toRoleplay({}, ['choice text'], null),
          startLine: 2,
        },
        {
          indent: 0,
          lines: ['* {{test2}} other choice'],
          startLine: 4,
        },
        {
          indent: 2,
          lines: [],
          render: XMLRenderer.toRoleplay({}, ['other choice text'], null),
          startLine: 2,
        },
      ];

      br.toRoleplay(blocks, log);

      expect(prettifyHTML(blocks[0].render + '')).toEqual(TestData.roleplayConditionalChoiceXML);
      expect(prettifyMsgs(log.finalize())).toEqual('');
    });

    it('alerts the user to choices without titles', () => {
      var log = new Logger();
      var blocks: Block[] = [
        {
          indent: 0,
          lines: ['_roleplay_', '', 'text', '', '* {{test1}}'],
          startLine: 5,
        },
        {
          indent: 2,
          lines: [],
          render: XMLRenderer.toRoleplay({}, ['choice text'], null),
          startLine: 7,
        },
      ];

      br.toRoleplay(blocks, log);

      expect(prettifyHTML(blocks[0].render + '')).toEqual(TestData.roleplayChoiceNoTitle);
      expect(prettifyMsgs(log.finalize())).toEqual(TestData.missingTitleErr);
    });

    it('alerts the user to choices without titles - invalid choice string', () => {
      var log = new Logger();
      var blocks: Block[] = [
        {
          indent: 0,
          lines: ['_roleplay_', '', 'text', '', '* {{test1'],
          startLine: 5,
        },
        {
          indent: 2,
          lines: [],
          render: XMLRenderer.toRoleplay({}, ['choice text'], null),
          startLine: 7,
        },
      ];

      br.toRoleplay(blocks, log);

      expect(prettifyHTML(blocks[0].render + '')).toEqual(TestData.roleplayChoiceNoParse);
      expect(prettifyMsgs(log.finalize())).toEqual(TestData.missingTitleErr);
    });

    it('renders with ID', () => {
      var log = new Logger();
      var blocks: Block[] = [
        { lines: [ '_Title_ (#testid123)', '', 'hi' ],
          indent: 4,
          startLine: 21
        }
      ];

      br.toRoleplay(blocks, log)

      expect(prettifyHTML(blocks[0].render + '')).toEqual(TestData.roleplayWithID);
      expect(prettifyMsgs(log.finalize())).toEqual('');
    });

    it('renders with JSON');

    it('errors if invalid roleplay attribute');

    it('errors if invalid choice attribute');

  });

  describe('toTrigger', () => {
    it('renders end', () => {
      var log = new Logger();
      var blocks: Block[] = [
        { lines: [ '**end**', '' ],
          indent: 4,
          startLine: 21
        }
      ];

      br.toTrigger(blocks, log)

      expect(prettifyHTML(blocks[0].render + '')).toEqual('<trigger data-line="21">end</trigger>');
      expect(prettifyMsgs(log.finalize())).toEqual('');
    });

    it('renders goto', () => {
      var log = new Logger();
      var blocks: Block[] = [
        { lines: [ '**goto testid123**', '' ],
          indent: 4,
          startLine: 21
        }
      ];

      br.toTrigger(blocks, log)

      expect(prettifyHTML(blocks[0].render + '')).toEqual('<trigger data-line="21">goto testid123</trigger>');
      expect(prettifyMsgs(log.finalize())).toEqual('');
    });

    it('renders condition', () => {
      var log = new Logger();
      var blocks: Block[] = [
        { lines: [ '**{{a}} end**', '' ],
          indent: 4,
          startLine: 21
        }
      ];

      br.toTrigger(blocks, log)

      expect(prettifyHTML(blocks[0].render + '')).toEqual('<trigger if="a" data-line="21">end</trigger>');
      expect(prettifyMsgs(log.finalize())).toEqual('');
    });

    it('errors if multiple blocks');

    it('errors on bad parsing');
  });

  describe('toQuest', () => {
    it('renders', () => {
      var log = new Logger();
      var block: Block = {
        lines: [ '#Quest Title' ],
        indent: 0,
        startLine: 0
      };

      br.toQuest(block, log)

      expect(prettifyHTML(block.render + '')).toEqual('<quest title="Quest Title" data-line="0"></quest>');
      expect(prettifyMsgs(log.finalize())).toEqual('');
    })

    it('errors if unparseable quest attribute', () => {
      var log = new Logger();
      var block: Block = {
        lines: [ '#Quest Title', 'minplayers1' ],
        indent: 0,
        startLine: 0
      };

      br.toQuest(block, log)

      expect(prettifyHTML(block.render + '')).toEqual('<quest title="Quest Title" data-line="0"></quest>');
      expect(prettifyMsgs(log.finalize())).toEqual(TestData.badParseQuestAttrError);
    });
  });

  describe('toMeta', () => {
  });

  describe('validate', () => {
  });

  describe('finalize', () => {
  });
});
