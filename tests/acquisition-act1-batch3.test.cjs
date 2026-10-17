/* Batch 3: literal reviewed identities and points; production resolver/render/import paths. */
'use strict';
const withoutAct2Continuations=require('./helpers/acquisition-checkpoint.cjs');
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const {readFileSync}=require('node:fs'),{join}=require('node:path'),{execFileSync}=require('node:child_process');
const metadata=require('../acquisition-metadata.js'),{createAcquisitionUI}=require('../acquisition-ui.js'),{generateBundle}=require('../scripts/build-acquisition-bundle.cjs');
const {harness:storyHarness,record}=require('./helpers/app-harness.cjs');
const root=join(__dirname,'..'),base='5a1edf08a52803a502a13e740f3a9ba8276cd2f6';
const baseline=JSON.parse(execFileSync('git',['show',base+':data/acquisition.v1.json'],{cwd:root,encoding:'utf8'}));
const data=JSON.parse(readFileSync(join(root,'data/acquisition.v1.json'),'utf8'));
const batch3Snapshot=JSON.parse(execFileSync('git',['show','1309bd94f7da4b6e91db0215be1b40046c682fba:data/acquisition.v1.json'],{cwd:root,encoding:'utf8'}));
const batch3IDs=new Set(batch3Snapshot.entries.map(e=>e.id));
const catalogue=JSON.parse(readFileSync(join(__dirname,'fixtures/vendor-catalogue.json'),'utf8'));
const clone=x=>JSON.parse(JSON.stringify(x)),key=x=>(x.act+'|'+x.name).toLowerCase();
// Allocated once before adding Batch 3 canonical data; literal approval oracle.
const approved = [
  {
    "name": "Boots of Aid and Comfort",
    "sourceRow": 24,
    "source": "https://bg3.wiki/wiki/Boots_of_Aid_and_Comfort",
    "entryId": "fa05981a-7a3c-4f69-a715-aca3c71d9075",
    "coverage": "reviewed",
    "binding": {
      "id": "683f9439-072a-46d4-9b4c-a92c8a638858",
      "act": "ACT 1",
      "progressKey": "act 1|boots of aid and comfort",
      "gameIds": [
        "MAG_Healer_TempHPOnHeal_Boots"
      ],
      "wikiPage": "Boots of Aid and Comfort"
    },
    "routes": [
      {
        "id": "f480fc7a-0f78-43ea-9118-931ebe99d9bf",
        "type": "purchase",
        "acts": [
          1
        ],
        "actor": {
          "name": "Grat",
          "wikiPage": "Grat"
        },
        "location": {
          "name": "Goblin Camp",
          "wikiPage": "Goblin Camp"
        },
        "sublocation": "Grat the Trader's shop",
        "coordinates": {
          "x": -99,
          "y": 424,
          "space": "Goblin Camp",
          "subject": "actor"
        },
        "conditions": {
          "prerequisites": [
            {
              "kind": "npc",
              "subject": "Purchase while Grat remains available to trade."
            }
          ]
        },
        "notes": [
          "No death-drop route or quest prerequisite is inferred from shop availability."
        ],
        "validity": "current",
        "sources": [
          {
            "url": "https://bg3.wiki/w/index.php?title=Boots_of_Aid_and_Comfort&oldid=416676",
            "revisionId": 416676,
            "section": "Where to find"
          },
          {
            "url": "https://bg3.wiki/w/index.php?title=Grat&oldid=414927",
            "revisionId": 414927,
            "section": "Store; Stock"
          }
        ],
        "review": {
          "state": "reviewed",
          "reviewedAt": "2026-10-17",
          "reviewer": "Codex BG3 Wiki primary-source Batch 3 review"
        },
        "coordinateReview": {
          "state": "reference",
          "reason": "Published Act One trader reference; Grat may move or become unavailable."
        }
      }
    ]
  },
  {
    "name": "Boots of Genial Striding",
    "sourceRow": 26,
    "source": "https://bg3.wiki/wiki/Boots_of_Genial_Striding",
    "entryId": "3b00c143-5b09-44b4-aaa3-253555c77bf5",
    "coverage": "reviewed",
    "binding": {
      "id": "246d2fa9-99cc-4aa5-89e4-77d0ebddb056",
      "act": "ACT 1",
      "progressKey": "act 1|boots of genial striding",
      "gameIds": [
        "MAG_TerrainWalkers_Boots"
      ],
      "wikiPage": "Boots of Genial Striding"
    },
    "routes": [
      {
        "id": "a4e8f99c-e50c-4637-97d9-f4a7c8db6129",
        "type": "purchase",
        "acts": [
          1
        ],
        "actor": {
          "name": "Blurg",
          "wikiPage": "Blurg"
        },
        "location": {
          "name": "Ebonlake Grotto",
          "wikiPage": "Ebonlake Grotto"
        },
        "sublocation": "Blurg's shop",
        "coordinates": {
          "x": 111,
          "y": -89,
          "space": "Ebonlake Grotto",
          "subject": "actor"
        },
        "conditions": null,
        "notes": [
          "No Omeluum investigation prerequisite or later-Act route is inferred."
        ],
        "validity": "current",
        "sources": [
          {
            "url": "https://bg3.wiki/w/index.php?title=Boots_of_Genial_Striding&oldid=416683",
            "revisionId": 416683,
            "section": "Where to find"
          },
          {
            "url": "https://bg3.wiki/w/index.php?title=Blurg&oldid=434059",
            "revisionId": 434059,
            "section": "Act One; Notable items sold"
          }
        ],
        "review": {
          "state": "reviewed",
          "reviewedAt": "2026-10-17",
          "reviewer": "Codex BG3 Wiki primary-source Batch 3 review"
        },
        "coordinateReview": {
          "state": "reference",
          "reason": "Published Act One trader reference; Blurg may move."
        }
      }
    ]
  },
  {
    "name": "Boots of Elemental Momentum",
    "sourceRow": 25,
    "source": "https://bg3.wiki/wiki/Boots_of_Elemental_Momentum",
    "entryId": "2d9a02e6-4f2e-4a1f-8ce9-e02ecd843c30",
    "coverage": "reviewed",
    "binding": {
      "id": "b7700e4f-58fa-4d52-88e9-4643c5b96336",
      "act": "ACT 1",
      "progressKey": "act 1|boots of elemental momentum",
      "gameIds": [
        "MAG_ElementalGish_MomentumOnElementalDamage_Boots"
      ],
      "wikiPage": "Boots of Elemental Momentum"
    },
    "routes": [
      {
        "id": "3b61581d-949a-4644-9226-b639322526f2",
        "type": "purchase",
        "acts": [
          1
        ],
        "actor": {
          "name": "Lady Esther",
          "wikiPage": "Esther"
        },
        "location": {
          "name": "Rosymorn Monastery Trail",
          "wikiPage": "Rosymorn Monastery Trail"
        },
        "sublocation": "Camp northeast of the Trielta Crags waypoint",
        "coordinates": {
          "x": -43,
          "y": -129,
          "space": "Rosymorn Monastery Trail",
          "subject": "actor"
        },
        "conditions": {
          "prerequisites": [
            {
              "kind": "npc",
              "subject": "Purchase while Lady Esther remains available to trade."
            }
          ]
        },
        "notes": [
          "Accepting or completing the egg request is not a purchase prerequisite."
        ],
        "validity": "current",
        "sources": [
          {
            "url": "https://bg3.wiki/w/index.php?title=Boots_of_Elemental_Momentum&oldid=416682",
            "revisionId": 416682,
            "section": "Where to find"
          },
          {
            "url": "https://bg3.wiki/w/index.php?title=Esther&oldid=425220",
            "revisionId": 425220,
            "section": "Notable items sold"
          }
        ],
        "review": {
          "state": "reviewed",
          "reviewedAt": "2026-10-17",
          "reviewer": "Codex BG3 Wiki primary-source Batch 3 review"
        },
        "coordinateReview": {
          "state": "reference",
          "reason": "Published Act One trader reference; Esther may move or become unavailable."
        }
      }
    ]
  },
  {
    "name": "Gloves of Dexterity",
    "sourceRow": 77,
    "source": "https://bg3.wiki/wiki/Gloves_of_Dexterity",
    "entryId": "8cde2948-005a-4835-b225-71ad89fcc747",
    "coverage": "reviewed",
    "binding": {
      "id": "ce6c141d-e46b-40ec-bd52-b0a321d283e9",
      "act": "ACT 1",
      "progressKey": "act 1|gloves of dexterity",
      "gameIds": [
        "MAG_BG_OfDexterity_Gloves"
      ],
      "wikiPage": "Gloves of Dexterity"
    },
    "routes": [
      {
        "id": "68f43e81-ea43-4924-ab19-a1c149e5fd3b",
        "type": "purchase",
        "acts": [
          1
        ],
        "actor": {
          "name": "A'jak'nir Jeera",
          "wikiPage": "Jeera"
        },
        "location": {
          "name": "Crèche Y'llek",
          "wikiPage": "Crèche Y'llek"
        },
        "sublocation": "A'jak'nir Jeera's shop",
        "coordinates": {
          "x": 1380,
          "y": -798,
          "space": "Crèche Y'llek",
          "subject": "location"
        },
        "conditions": {
          "prerequisites": [
            {
              "kind": "npc",
              "subject": "Purchase while Jeera remains available to trade."
            }
          ]
        },
        "notes": [
          "Retain item shop point 1380,-798 and alternate NPC point 1387,-821 without averaging or claiming an exact actor coordinate."
        ],
        "validity": "current",
        "sources": [
          {
            "url": "https://bg3.wiki/w/index.php?title=Gloves_of_Dexterity&oldid=418968",
            "revisionId": 418968,
            "section": "Where to find"
          },
          {
            "url": "https://bg3.wiki/w/index.php?title=Jeera&oldid=416522",
            "revisionId": 416522,
            "section": "Involvement; Notable items sold"
          }
        ],
        "review": {
          "state": "reviewed",
          "reviewedAt": "2026-10-17",
          "reviewer": "Codex BG3 Wiki primary-source Batch 3 review"
        },
        "coordinateReview": {
          "state": "reference",
          "reason": "Item page gives shop reference 1380,-798; Jeera's page places her at 1387,-821. This is not a guaranteed standing position."
        }
      }
    ]
  },
  {
    "name": "Gloves of Missile Snaring",
    "sourceRow": 80,
    "source": "https://bg3.wiki/wiki/Gloves_of_Missile_Snaring",
    "entryId": "babd48c1-f641-4854-b22c-64b82b61e680",
    "coverage": "reviewed",
    "binding": {
      "id": "deba51b7-88d8-4383-915f-ee0d72c7aea2",
      "act": "ACT 1",
      "progressKey": "act 1|gloves of missile snaring",
      "gameIds": [
        "UNI_ARM_OfMissileSnaring_Gloves"
      ],
      "wikiPage": "Gloves of Missile Snaring"
    },
    "routes": [
      {
        "id": "eacef3f5-3d1a-4167-b8c1-50d0eb2a68d0",
        "type": "purchase",
        "acts": [
          1
        ],
        "actor": {
          "name": "Arron",
          "wikiPage": "Arron"
        },
        "location": {
          "name": "The Hollow",
          "wikiPage": "The Hollow"
        },
        "sublocation": "Shop next to the Silvanus statue",
        "coordinates": {
          "x": 205,
          "y": 516,
          "space": "The Hollow",
          "subject": "actor"
        },
        "conditions": {
          "prerequisites": [
            {
              "kind": "npc",
              "subject": "Purchase while Arron remains available to trade."
            }
          ]
        },
        "notes": null,
        "validity": "current",
        "sources": [
          {
            "url": "https://bg3.wiki/w/index.php?title=Gloves_of_Missile_Snaring&oldid=418973",
            "revisionId": 418973,
            "section": "Where to find"
          },
          {
            "url": "https://bg3.wiki/w/index.php?title=Arron&oldid=414921",
            "revisionId": 414921,
            "section": "Notable items sold"
          }
        ],
        "review": {
          "state": "reviewed",
          "reviewedAt": "2026-10-17",
          "reviewer": "Codex BG3 Wiki primary-source Batch 3 review"
        },
        "coordinateReview": {
          "state": "reference",
          "reason": "Published Act One trader reference; Arron may move or become unavailable."
        }
      }
    ]
  },
  {
    "name": "Hunting Shortbow",
    "sourceRow": 100,
    "source": "https://bg3.wiki/wiki/Hunting_Shortbow",
    "entryId": "62ca4288-e1a3-4a05-bb5f-f0621a561892",
    "coverage": "reviewed",
    "binding": {
      "id": "7ae2bc2b-3412-42dd-8f9d-137546c7b1cd",
      "act": "ACT 1",
      "progressKey": "act 1|hunting shortbow",
      "gameIds": [
        "MAG_Hunting_Shortbow"
      ],
      "wikiPage": "Hunting Shortbow"
    },
    "routes": [
      {
        "id": "978f9bf5-d3e3-4579-8e5a-19b7cfba8e01",
        "type": "purchase",
        "acts": [
          1
        ],
        "actor": {
          "name": "Dammon",
          "wikiPage": "Dammon"
        },
        "location": {
          "name": "The Hollow",
          "wikiPage": "The Hollow"
        },
        "sublocation": "Dammon's Act One shop",
        "coordinates": {
          "x": 177,
          "y": 562,
          "space": "The Hollow",
          "subject": "actor"
        },
        "conditions": {
          "prerequisites": [
            {
              "kind": "npc",
              "subject": "Purchase in Act One before Dammon leaves with the tiefling refugees."
            }
          ]
        },
        "notes": [
          "Dammon becomes unavailable after the refugee departure until Act Two. This route promises no later-Act acquisition. Keep alternate NPC point 180,561."
        ],
        "validity": "current",
        "sources": [
          {
            "url": "https://bg3.wiki/w/index.php?title=Hunting_Shortbow&oldid=419633",
            "revisionId": 419633,
            "section": "Where to find"
          },
          {
            "url": "https://bg3.wiki/w/index.php?title=Dammon&oldid=414844",
            "revisionId": 414844,
            "section": "Involvement; Items sold; Act One"
          }
        ],
        "review": {
          "state": "reviewed",
          "reviewedAt": "2026-10-17",
          "reviewer": "Codex BG3 Wiki primary-source Batch 3 review"
        },
        "coordinateReview": {
          "state": "reference",
          "reason": "Item shop reference is 177,562; Dammon's Act One NPC point is 180,561. A moving trader is not an exact acquisition point."
        }
      }
    ]
  },
  {
    "name": "The Speedy Lightfeet",
    "sourceRow": 201,
    "source": "https://bg3.wiki/wiki/The_Speedy_Lightfeet",
    "entryId": "143d5e41-7a7d-4d56-9fee-3e4e9e70706f",
    "coverage": "reviewed",
    "binding": {
      "id": "19334d35-fcc3-49e0-be0d-eab833e1b12c",
      "act": "ACT 1",
      "progressKey": "act 1|the speedy lightfeet",
      "gameIds": [
        "MAG_ChargedLightning_Dash_Boots"
      ],
      "wikiPage": "The Speedy Lightfeet"
    },
    "routes": [
      {
        "id": "f98e234d-2800-401d-a33e-6848baf7ab65",
        "type": "container",
        "acts": [
          1
        ],
        "actor": null,
        "location": {
          "name": "Blighted Village",
          "wikiPage": "Blighted Village"
        },
        "sublocation": "Heavy chest in the windmill cellar",
        "coordinates": {
          "x": -711,
          "y": -412,
          "space": "Windmill Cellar",
          "subject": "container"
        },
        "conditions": null,
        "notes": [
          "The cellar chest is at -711,-412. The exterior hatch at -11,436 is a different subject/map space and is not substituted. Rescuing Barcus is not an acquisition prerequisite."
        ],
        "validity": "current",
        "sources": [
          {
            "url": "https://bg3.wiki/w/index.php?title=The_Speedy_Lightfeet&oldid=424113",
            "revisionId": 424113,
            "section": "Where to find"
          },
          {
            "url": "https://bg3.wiki/w/index.php?title=Blighted_Village&oldid=433668",
            "revisionId": 433668,
            "section": "Windmill"
          }
        ],
        "review": {
          "state": "reviewed",
          "reviewedAt": "2026-10-17",
          "reviewer": "Codex BG3 Wiki primary-source Batch 3 review"
        },
        "coordinateReview": {
          "state": "exact"
        }
      }
    ]
  },
  {
    "name": "Helmet of Smiting",
    "sourceRow": 95,
    "source": "https://bg3.wiki/wiki/Helmet_of_Smiting",
    "entryId": "6bf2c1b3-7f6d-423b-9657-bb12d932e830",
    "coverage": "reviewed",
    "binding": {
      "id": "8846333b-f1fc-42d8-8f22-92d7c07caa20",
      "act": "ACT 1",
      "progressKey": "act 1|helmet of smiting",
      "gameIds": [
        "MAG_Paladin_SmiteSpellsSupport_Helmet"
      ],
      "wikiPage": "Helmet of Smiting"
    },
    "routes": [
      {
        "id": "9299369a-ee3c-46aa-90cc-7de4a195b03d",
        "type": "container",
        "acts": [
          1
        ],
        "actor": null,
        "location": {
          "name": "Selûnite Outpost",
          "wikiPage": "Selûnite Outpost"
        },
        "sublocation": "Locked gilded chest southwest of the waypoint",
        "coordinates": {
          "x": 163,
          "y": -248,
          "space": "Selûnite Outpost",
          "subject": "container"
        },
        "conditions": null,
        "notes": [
          "Alternate location-article chest point: 163,-244. No averaging or exactness claim."
        ],
        "validity": "current",
        "sources": [
          {
            "url": "https://bg3.wiki/w/index.php?title=Helmet_of_Smiting&oldid=419475",
            "revisionId": 419475,
            "section": "Where to find"
          },
          {
            "url": "https://bg3.wiki/w/index.php?title=Sel%C3%BBnite_Outpost&oldid=431112",
            "revisionId": 431112,
            "section": "Outpost; Loot"
          }
        ],
        "review": {
          "state": "reviewed",
          "reviewedAt": "2026-10-17",
          "reviewer": "Codex BG3 Wiki primary-source Batch 3 review"
        },
        "coordinateReview": {
          "state": "reference",
          "reason": "Item chest point is 163,-248; the Selûnite Outpost article gives 163,-244. Retain the published item point as a navigation reference."
        }
      }
    ]
  },
  {
    "name": "Nature's Snare",
    "sourceRow": 121,
    "source": "https://bg3.wiki/wiki/Nature's_Snare",
    "entryId": "db95448a-64e1-4f92-ab28-7143568144c0",
    "coverage": "reviewed",
    "binding": {
      "id": "bbb0eec4-8d87-4771-9016-e17952f0bb7e",
      "act": "ACT 1",
      "progressKey": "act 1|nature's snare",
      "gameIds": [
        "DEN_TunnelStaff"
      ],
      "wikiPage": "Nature's Snare"
    },
    "routes": [
      {
        "id": "452274a9-869e-4550-913c-2fce0269242e",
        "type": "container",
        "acts": [
          1
        ],
        "actor": null,
        "location": {
          "name": "Underground Passage",
          "wikiPage": "Underground Passage"
        },
        "sublocation": "Locked, trapped heavy chest",
        "coordinates": {
          "x": -425,
          "y": -200,
          "space": "Underground Passage",
          "subject": "container"
        },
        "conditions": {
          "prerequisites": [
            {
              "kind": "interaction",
              "subject": "Open with the Charred Key OR lockpicking."
            }
          ]
        },
        "notes": [
          "The chest is trapped. Noticing or disarming the trap is optional, not a universal acquisition prerequisite. Neither key nor lockpicking is individually mandatory."
        ],
        "validity": "current",
        "sources": [
          {
            "url": "https://bg3.wiki/w/index.php?title=Nature%27s_Snare&oldid=438410",
            "revisionId": 438410,
            "section": "Where to find"
          },
          {
            "url": "https://bg3.wiki/w/index.php?title=Underground_Passage&oldid=424498",
            "revisionId": 424498,
            "section": "Overview"
          }
        ],
        "review": {
          "state": "reviewed",
          "reviewedAt": "2026-10-17",
          "reviewer": "Codex BG3 Wiki primary-source Batch 3 review"
        },
        "coordinateReview": {
          "state": "exact"
        }
      }
    ]
  },
  {
    "name": "Moondrop Pendant",
    "sourceRow": 118,
    "source": "https://bg3.wiki/wiki/Moondrop_Pendant",
    "entryId": "677b65b5-18a8-416e-a587-f2a42eddfd02",
    "coverage": "reviewed",
    "binding": {
      "id": "7b944d6b-a111-4248-a565-3e2688c62fc8",
      "act": "ACT 1",
      "progressKey": "act 1|moondrop pendant",
      "gameIds": [
        "MAG_LowHP_IgnoreAttackOfOpportunity_Amulet"
      ],
      "wikiPage": "Moondrop Pendant"
    },
    "routes": [
      {
        "id": "30a65b7c-10e3-415f-851a-63979edd9d9b",
        "type": "container",
        "acts": [
          1
        ],
        "actor": null,
        "location": {
          "name": "Owlbear Nest",
          "wikiPage": "Owlbear Nest"
        },
        "sublocation": "Magically sealed gilded chest at the Selûnite shrine",
        "coordinates": {
          "x": -321,
          "y": -135,
          "space": "Owlbear Nest",
          "subject": "container"
        },
        "conditions": {
          "prerequisites": [
            {
              "kind": "interaction",
              "subject": "Open with the Selûnite Prayer Sheet (reader other than Shadowheart), OR Knock, OR a Cleric of Selûne."
            }
          ]
        },
        "notes": [
          "These are alternative opening methods, not cumulative prerequisites. Finding/identifying the prayer is not required for the alternative spell/class methods. The item page describes the prayer route; the shrine article supplies the alternatives and reader restriction."
        ],
        "validity": "current",
        "sources": [
          {
            "url": "https://bg3.wiki/w/index.php?title=Moondrop_Pendant&oldid=421071",
            "revisionId": 421071,
            "section": "Where to find"
          },
          {
            "url": "https://bg3.wiki/w/index.php?title=Owlbear_Nest&oldid=431001",
            "revisionId": 431001,
            "section": "Selûnite Shrine"
          }
        ],
        "review": {
          "state": "reviewed",
          "reviewedAt": "2026-10-17",
          "reviewer": "Codex BG3 Wiki primary-source Batch 3 review"
        },
        "coordinateReview": {
          "state": "exact"
        }
      }
    ]
  },
  {
    "name": "Ring of Poison Resistance",
    "sourceRow": 140,
    "source": "https://bg3.wiki/wiki/Ring_of_Poison_Resistance",
    "entryId": "d894a6aa-4848-47e0-ae8d-1b32da567e74",
    "coverage": "reviewed",
    "binding": {
      "id": "372b8c5f-0f97-4d42-9993-555c3ef1a4e2",
      "act": "ACT 1",
      "progressKey": "act 1|ring of poison resistance",
      "gameIds": [
        "UNI_RingOfPoisonResistance",
        "ARM_RingOfPoisonResistance"
      ],
      "wikiPage": "Ring of Poison Resistance"
    },
    "routes": [
      {
        "id": "a3a83818-828d-4e2f-9f9e-37b020584b09",
        "type": "actor_loot",
        "acts": [
          1
        ],
        "actor": {
          "name": "Skeleton"
        },
        "location": {
          "name": "Shattered Sanctum",
          "wikiPage": "Shattered Sanctum"
        },
        "sublocation": "Open sarcophagus before the Worg Pens",
        "coordinates": {
          "x": 338,
          "y": 14,
          "space": "Shattered Sanctum",
          "subject": "corpse"
        },
        "conditions": null,
        "notes": [
          "Existing skeleton inside an open sarcophagus; no living NPC must be killed. Alternate loot-list point: 338,15."
        ],
        "validity": "current",
        "sources": [
          {
            "url": "https://bg3.wiki/w/index.php?title=Ring_of_Poison_Resistance&oldid=422389",
            "revisionId": 422389,
            "section": "Where to find"
          },
          {
            "url": "https://bg3.wiki/w/index.php?title=Shattered_Sanctum&oldid=431013",
            "revisionId": 431013,
            "section": "East; Torture chamber; Loot"
          }
        ],
        "review": {
          "state": "reviewed",
          "reviewedAt": "2026-10-17",
          "reviewer": "Codex BG3 Wiki primary-source Batch 3 review"
        },
        "coordinateReview": {
          "state": "reference",
          "reason": "Item and location prose give skeleton point 338,14; the location loot list gives 338,15. Retain the first point as a corpse reference."
        }
      }
    ]
  },
  {
    "name": "Smuggler's Ring",
    "sourceRow": 160,
    "source": "https://bg3.wiki/wiki/Smuggler's_Ring",
    "entryId": "397faf4f-f331-45ee-a6cf-b60d034872f5",
    "coverage": "reviewed",
    "binding": {
      "id": "a5968f21-e022-4ecd-91d1-c02dbadeedca",
      "act": "ACT 1",
      "progressKey": "act 1|smuggler's ring",
      "gameIds": [
        "UNI_PLA_SmugglersRing",
        "PLA_SmugglerRing"
      ],
      "wikiPage": "Smuggler's Ring"
    },
    "routes": [
      {
        "id": "fa325c18-e482-49d1-92bf-301ec69b82b6",
        "type": "actor_loot",
        "acts": [
          1
        ],
        "actor": {
          "name": "Skeleton"
        },
        "location": {
          "name": "The Risen Road",
          "wikiPage": "The Risen Road"
        },
        "sublocation": "Bushes on the lower riverside path near the broken bridge",
        "coordinates": {
          "x": 58,
          "y": 516,
          "space": "The Risen Road",
          "subject": "corpse"
        },
        "conditions": null,
        "notes": [
          "The skeleton is concealed in bushes, not a living NPC target. Alternate location point: 57,516."
        ],
        "validity": "current",
        "sources": [
          {
            "url": "https://bg3.wiki/w/index.php?title=Smuggler%27s_Ring&oldid=423333",
            "revisionId": 423333,
            "section": "Where to find"
          },
          {
            "url": "https://bg3.wiki/w/index.php?title=The_Risen_Road&oldid=425790",
            "revisionId": 425790,
            "section": "Overview"
          }
        ],
        "review": {
          "state": "reviewed",
          "reviewedAt": "2026-10-17",
          "reviewer": "Codex BG3 Wiki primary-source Batch 3 review"
        },
        "coordinateReview": {
          "state": "reference",
          "reason": "Item skeleton point is 58,516; the Risen Road article gives 57,516. Retain the item point as a corpse reference."
        }
      }
    ]
  },
  {
    "name": "Spurred Band",
    "sourceRow": 168,
    "source": "https://bg3.wiki/wiki/Spurred_Band",
    "entryId": "32b79f91-e548-441d-90a2-36c23caba57f",
    "coverage": "reviewed",
    "binding": {
      "id": "33fec110-849f-41e3-aa8a-c4957be043bd",
      "act": "ACT 1",
      "progressKey": "act 1|spurred band",
      "gameIds": [
        "MAG_Mobility_LowHP_Momentum_Ring"
      ],
      "wikiPage": "Spurred Band"
    },
    "routes": [
      {
        "id": "c520df11-f165-4901-b516-93bdeb728c18",
        "type": "actor_loot",
        "acts": [
          1
        ],
        "actor": {
          "name": "Skeleton"
        },
        "location": {
          "name": "Whispering Depths",
          "wikiPage": "Whispering Depths"
        },
        "sublocation": "Skeleton beside a backpack",
        "coordinates": {
          "x": -495,
          "y": -365,
          "space": "Whispering Depths",
          "subject": "corpse"
        },
        "conditions": null,
        "notes": [
          "Found on an existing skeleton; no living NPC kill requirement."
        ],
        "validity": "current",
        "sources": [
          {
            "url": "https://bg3.wiki/w/index.php?title=Spurred_Band&oldid=437985",
            "revisionId": 437985,
            "section": "Where to find"
          },
          {
            "url": "https://bg3.wiki/w/index.php?title=Whispering_Depths&oldid=370813",
            "revisionId": 370813,
            "section": "Loot"
          }
        ],
        "review": {
          "state": "reviewed",
          "reviewedAt": "2026-10-17",
          "reviewer": "Codex BG3 Wiki primary-source Batch 3 review"
        },
        "coordinateReview": {
          "state": "exact"
        }
      }
    ]
  },
  {
    "name": "Staff of Crones",
    "sourceRow": 170,
    "source": "https://bg3.wiki/wiki/Staff_of_Crones",
    "entryId": "b33d5eb0-be1c-4d66-9e4b-41d2636c3cc0",
    "coverage": "reviewed",
    "binding": {
      "id": "ace6a2f5-410d-4ad4-b929-d5044fbc926b",
      "act": "ACT 1",
      "progressKey": "act 1|staff of crones",
      "gameIds": [
        "S_HAG_GaleMagicItem",
        "Quest_HAG_HagLair_Staff"
      ],
      "wikiPage": "Staff of Crones"
    },
    "routes": [
      {
        "id": "9d0f4fc9-faa6-4111-8a2e-246cb9c83f8a",
        "type": "world",
        "acts": [
          1
        ],
        "actor": null,
        "location": {
          "name": "Overgrown Tunnel",
          "wikiPage": "Overgrown Tunnel"
        },
        "sublocation": "Ground pickup in the treasure/workshop room",
        "coordinates": {
          "x": -416,
          "y": 599,
          "space": "Overgrown Tunnel",
          "subject": "item"
        },
        "conditions": null,
        "notes": [
          "Alternate workshop point: -412,606. Preserve the treasure-room/workshop naming difference in evidence; do not rewrite catalogue geography. Reaching the pickup does not universally require defeating or killing Ethel."
        ],
        "validity": "current",
        "sources": [
          {
            "url": "https://bg3.wiki/w/index.php?title=Staff_of_Crones&oldid=423535",
            "revisionId": 423535,
            "section": "Where to find"
          },
          {
            "url": "https://bg3.wiki/w/index.php?title=Overgrown_Tunnel&oldid=433650",
            "revisionId": 433650,
            "section": "Acrid Workshop; Notes and references"
          }
        ],
        "review": {
          "state": "reviewed",
          "reviewedAt": "2026-10-17",
          "reviewer": "Codex BG3 Wiki primary-source Batch 3 review"
        },
        "coordinateReview": {
          "state": "reference",
          "reason": "Item page gives -416,599 in the Ancient Abode treasure room; the tunnel article places the staff at -412,606 in the Acrid Workshop. Retain the item point as a reference."
        }
      }
    ]
  },
  {
    "name": "Skybreaker",
    "sourceRow": 158,
    "source": "https://bg3.wiki/wiki/Skybreaker",
    "entryId": "b5c8557e-fa6b-4341-ab21-4378fbbfd7e8",
    "coverage": "reviewed",
    "binding": {
      "id": "d9a423dd-37ca-40db-974a-4844b14238e3",
      "act": "ACT 1",
      "progressKey": "act 1|skybreaker",
      "gameIds": [
        "UNI_UND_DuergarBlacksmithHammer",
        "UND_DuergarBlacksmithHammer"
      ],
      "wikiPage": "Skybreaker"
    },
    "routes": [
      {
        "id": "b0fe5229-a400-4176-bef5-5f7793c2c061",
        "type": "container",
        "acts": [
          1
        ],
        "actor": null,
        "location": {
          "name": "Arcane Tower",
          "wikiPage": "Arcane Tower"
        },
        "sublocation": "Locked heavy chest outside the entrance",
        "coordinates": {
          "x": 28,
          "y": -295,
          "space": "Arcane Tower",
          "subject": "container"
        },
        "conditions": null,
        "notes": [
          "Alternate entrance-chest point: 27,-298. Do not average the coordinates or substitute a tower interior point."
        ],
        "validity": "current",
        "sources": [
          {
            "url": "https://bg3.wiki/w/index.php?title=Skybreaker&oldid=423268",
            "revisionId": 423268,
            "section": "Where to find"
          },
          {
            "url": "https://bg3.wiki/w/index.php?title=Arcane_Tower&oldid=431380",
            "revisionId": 431380,
            "section": "Loot; Second floor (main entrance)"
          }
        ],
        "review": {
          "state": "reviewed",
          "reviewedAt": "2026-10-17",
          "reviewer": "Codex BG3 Wiki primary-source Batch 3 review"
        },
        "coordinateReview": {
          "state": "reference",
          "reason": "Item chest point is 28,-295; the tower article gives 27,-298 for the entrance chest. Retain the item point as a navigation reference."
        }
      }
    ]
  }
];
const boundary={exports:{}};
const harnessSource=readFileSync(join(__dirname,'acquisition-ui.test.cjs'),'utf8').split("test('Phase 2 has a frozen standalone factory")[0];
vm.runInNewContext(harnessSource+'\nmodule.exports={itemHarness,required,surfaces,entireAttributes,discovery};',{require,__dirname,module:boundary,process,URL});
const {itemHarness,required,surfaces,entireAttributes,discovery}=boundary.exports;
const rows=approved.map(s=>{const found=catalogue.filter(row=>key(row)===s.binding.progressKey);assert.equal(found.length,1);return found[0]});
const normalized=Array.from(itemHarness(rows,{bundle:false}).app.items());
const resolver=metadata.createResolver(data),ui=createAcquisitionUI(metadata,data);
const itemFor=s=>normalized.find(x=>key(x)===s.binding.progressKey);
const entryFor=s=>{const e=data.entries.find(e=>e.id===s.entryId);assert.ok(e,'Missing reviewed Batch 3 entry: '+s.name);return withoutAct2Continuations(e)};
function browser(source=readFileSync(join(root,'assets/acquisition-pilot.js'),'utf8')){
 const calls=[],blocked=name=>()=>{calls.push(name);throw Error('Unexpected '+name)};
 const sandbox={URL,fetch:blocked('network'),setTimeout:blocked('timer'),document:new Proxy({},{get:blocked('DOM')}),localStorage:new Proxy({},{get:blocked('storage')})};
 sandbox.window=sandbox;vm.runInNewContext(source,sandbox);return {ui:sandbox.BG3AcquisitionUI,calls};
}
for(const spec of approved){
 test('Batch 3 exact catalogue identity and full strong-ID binding: '+spec.name,()=>{
  const raw=rows.find(x=>key(x)===spec.binding.progressKey);assert.equal(raw.sourceRow,spec.sourceRow);assert.deepEqual(raw.gameIds,spec.binding.gameIds);assert.equal(raw.links.Name,spec.source);
  assert.deepEqual(entryFor(spec).bindings,[spec.binding]);assert.equal(resolver.resolve(itemFor(spec))?.id,spec.entryId);
 });
 test('Batch 3 unknown/malformed/partial strong IDs never fall back: '+spec.name,()=>{
  const item=itemFor(spec);assert.equal(resolver.resolve(item)?.id,spec.entryId);assert.equal(resolver.resolve({...item,gameIds:[...spec.binding.gameIds].reverse()})?.id,spec.entryId);
  for(const changed of [{...item,gameIds:['UNKNOWN_BATCH_3_ID']},{...item,gameIds:[...spec.binding.gameIds,'EXTRA_ID']},{...item,gameIds:[]},{...item,gameIds:null},{...item,act:'ACT 2'},{...item,name:spec.name+' lookalike'},{...item,source:'https://bg3.wiki/wiki/Unknown_Batch_2_Item'}])assert.equal(resolver.resolve(changed),null);
  if(spec.binding.gameIds.length>1)for(const id of spec.binding.gameIds)assert.equal(resolver.resolve({...item,gameIds:[id]}),null);
 });
 test('Batch 3 literal route counts, methods, anchor roles and reviewed coordinates: '+spec.name,()=>{
  assert.deepEqual(entryFor(spec).routes,spec.routes);assert.equal(entryFor(spec).routes.length,spec.routes.length);
  for(const r of entryFor(spec).routes){assert.ok(['exact','reference'].includes(r.coordinateReview.state));assert.ok(r.coordinates);assert.notDeepEqual([r.coordinates.x,r.coordinates.y],[0,0]);assert.equal(r.validity,'current');if(r.coordinateReview.state==='reference')assert.ok(r.coordinateReview.reason.trim());}
 });
 test('Batch 3 pinned primary-source evidence and specific subjects: '+spec.name,()=>{
  const e=entryFor(spec);for(const [i,r] of e.routes.entries()){
   assert.deepEqual(r.sources,spec.routes[i].sources);assert.ok(r.sources.length);
   for(const source of r.sources){const u=new URL(source.url);assert.equal(u.origin,'https://bg3.wiki');assert.equal(u.pathname,'/w/index.php');assert.equal(Number(u.searchParams.get('oldid')),source.revisionId);assert.ok(source.section.trim());}
  }
 });
 test('Batch 3 real desktop/mobile Full keeps Effect then concise Where to find and one Wiki link: '+spec.name,()=>{
  const raw=rows.find(x=>key(x)===spec.binding.progressKey),h=itemHarness([raw],{dataset:data});
  for(const surface of surfaces(h)){
   const details=required(surface,'details'),effects=required(details,'.item-effects'),where=required(details,'.acquisition-enrichment'),grid=required(details,'.detailgrid');
   assert.ok(effects.textContent.includes(raw.description));if(raw.properties)assert.ok(effects.textContent.includes(raw.properties));assert.ok(grid.children.indexOf(effects)<grid.children.indexOf(where));
   assert.equal(required(where,'h4').textContent,'Where to find');assert.equal(where.querySelectorAll('.acquisition-route').length,spec.routes.length+withoutAct2Continuations.continuationCount(spec.entryId));
   for(const r of spec.routes){assert.ok(where.textContent.includes(`X: ${r.coordinates.x} Y: ${r.coordinates.y}`));assert.ok(where.textContent.includes(r.sublocation));}
   assert.equal(where.querySelectorAll('.acquisition-point').length,spec.routes.length+withoutAct2Continuations.continuationCount(spec.entryId));
   for(const heading of where.querySelectorAll('.acquisition-route-heading'))assert.match(heading.textContent,/^(?:Container|Loot|Vendor|Quest reward|Craft|World):/);
   assert.doesNotMatch(where.textContent,/Route \d|Shared location|Prerequisites|References|Notes:/);
   assert.equal(surface.querySelectorAll('a').length,1);assert.equal(required(surface,'.item-reference').getAttribute('href'),spec.source);assert.equal(surface.querySelectorAll('.acquisition-references,.acquisition-reference').length,0);
  }
 });
 for(const mode of ['minimal','light'])test('Batch 3 '+mode+' never constructs enrichment DOM and removes Full on transition: '+spec.name,()=>{
  const raw=rows.find(x=>key(x)===spec.binding.progressKey),h=itemHarness([raw],{dataset:data,mode});assert.equal(h.acquisitionCalls.length,0);assert.deepEqual(clone(ui.render(itemFor(spec),mode)),{acquisitionHtml:'',referencesHtml:''});
  for(const surface of surfaces(h)){required(required(surface,'details'),'summary').click();assert.equal(surface.querySelectorAll('.acquisition-enrichment,.acquisition-coordinate,.acquisition-coordinate-note,.acquisition-navigation,.acquisition-route').length,0);assert.ok(!entireAttributes(surface).includes('coordinateReview'));}
  const state=clone(discovery(h));h.mode('full');assert.equal(surfaces(h).filter(x=>x.querySelector('.acquisition-enrichment')).length,2);h.mode(mode);assert.deepEqual(clone(discovery(h)),state);assert.ok(surfaces(h).every(x=>!x.querySelector('.acquisition-enrichment')));
 });
 test('Batch 3 generated/browser/offline output equals the real canonical renderer: '+spec.name,()=>{
  assert.ok(ui.render(itemFor(spec),'full').acquisitionHtml);const live=browser(),offline=browser(live.ui.offlineSource());
  for(const runtime of [live,offline]){assert.deepEqual(clone(runtime.ui.render(itemFor(spec),'full')),clone(ui.render(itemFor(spec),'full')));assert.deepEqual(runtime.calls,[]);}
 });
 test('Batch 3 cached identity preserves input and never changes progress keys: '+spec.name,()=>{
  const item=itemFor(spec),before=clone(item),h=itemHarness([item],{dataset:data,cached:true});assert.equal(resolver.resolve(h.app.items()[0])?.id,spec.entryId);for(const surface of surfaces(h))assert.equal(surface.querySelectorAll('.acquisition-enrichment').length,1);assert.deepEqual(clone(item),before);
 });
}
const byName=name=>approved.find(s=>s.name===name);
test('Batch 3 appends only fifteen entries/bindings/routes and preserves all seventy existing objects',()=>{
 const scoped={...data,datasetVersion:batch3Snapshot.datasetVersion,entries:data.entries.filter(e=>batch3IDs.has(e.id)).map(withoutAct2Continuations)};assert.deepEqual(scoped,batch3Snapshot);
 assert.equal(scoped.schemaVersion,2);assert.equal(scoped.datasetVersion,'2.3.0-act1.batch3');assert.equal(metadata.validateDataset(data).ok,true);assert.equal(scoped.entries.length,85);
 assert.deepEqual(scoped.entries.slice(0,70),baseline.entries);const added=scoped.entries.slice(70);assert.deepEqual(added.map(e=>e.id),approved.map(s=>s.entryId));assert.deepEqual(added.flatMap(e=>e.bindings),approved.map(s=>s.binding));assert.deepEqual(added.flatMap(e=>e.routes),approved.flatMap(s=>s.routes));
 assert.equal(scoped.entries.flatMap(e=>e.bindings).length,86);assert.equal(scoped.entries.flatMap(e=>e.routes).length,104);
});
test('Batch 3 has four Exact, eleven Reference, zero new exceptions and no unresolved coordinates',()=>{
 const scoped=data.entries.filter(e=>batch3IDs.has(e.id)).map(withoutAct2Continuations);const added=scoped.slice(70).flatMap(e=>e.routes),all=scoped.flatMap(e=>e.routes);assert.equal(added.length,15);
 for(const [state,count] of [['exact',4],['reference',11],['not_applicable',0]])assert.equal(added.filter(r=>r.coordinateReview.state===state).length,count);
 assert.equal(added.filter(r=>r.coordinates===null).length,0);for(const [state,count] of [['exact',38],['reference',61],['not_applicable',5]])assert.equal(all.filter(r=>r.coordinateReview.state===state).length,count);assert.equal(all.filter(r=>['pending','conflict','not_documented'].includes(r.coordinateReview.state)).length,0);
});
test('Batch 3 Moondrop preserves three alternative opening methods and the prayer-reader restriction',()=>{
 const s=byName('Moondrop Pendant'),r=entryFor(s).routes[0];assert.equal(r.type,'container');assert.equal(r.coordinates.subject,'container');assert.equal(r.coordinateReview.state,'exact');assert.equal(r.conditions.prerequisites.length,1);
 assert.equal(r.conditions.prerequisites[0].subject,'Open with the Selûnite Prayer Sheet (reader other than Shadowheart), OR Knock, OR a Cleric of Selûne.');assert.doesNotMatch(JSON.stringify(r.conditions),/DC|Religion|Perception|kill|defeat/i);
 const h=itemHarness([rows.find(x=>x.sourceRow===118)],{dataset:data});for(const surface of surfaces(h)){const where=required(surface,'.acquisition-enrichment');assert.equal(where.querySelectorAll('.acquisition-route').length,1);assert.ok(where.textContent.includes('Conditional route — see Wiki.'));assert.doesNotMatch(where.textContent,/Prayer Sheet|DC|Religion|Perception|Notes:/);}
});
test('Batch 3 Nature Snare keeps lock-opening alternatives without mandatory trap checks',()=>{
 const r=entryFor(byName("Nature's Snare")).routes[0];assert.equal(r.conditions.prerequisites[0].subject,'Open with the Charred Key OR lockpicking.');assert.match(r.sublocation,/Locked, trapped/);assert.doesNotMatch(JSON.stringify(r.conditions),/DC|check|disarm|Perception/i);assert.equal(r.coordinateReview.state,'exact');
});
test('Batch 3 Speedy Lightfeet pins the actual cellar chest, never the outside hatch or Barcus rescue',()=>{
 const r=entryFor(byName('The Speedy Lightfeet')).routes[0];assert.deepEqual(r.coordinates,{x:-711,y:-412,space:'Windmill Cellar',subject:'container'});assert.equal(r.coordinateReview.state,'exact');assert.equal(r.conditions,null);assert.match(r.notes.join(' '),/-11,436/);
 const h=itemHarness([rows.find(x=>x.sourceRow===201)],{dataset:data});for(const surface of surfaces(h)){const where=required(surface,'.acquisition-enrichment');assert.ok(where.textContent.includes('windmill cellar'));assert.ok(where.textContent.includes('X: -711 Y: -412'));assert.doesNotMatch(where.textContent,/Barcus|-11|436|rescu/i);}
});
test('Batch 3 Staff of Crones remains ground pickup with both source points and no Ethel-kill prerequisite',()=>{
 const r=entryFor(byName('Staff of Crones')).routes[0];assert.equal(r.type,'world');assert.equal(r.actor,null);assert.equal(r.conditions,null);assert.deepEqual([r.coordinates.x,r.coordinates.y],[-416,599]);assert.equal(r.coordinateReview.state,'reference');assert.match(r.notes.join(' '),/-412,606/);assert.match(r.coordinateReview.reason,/Ancient Abode.*Acrid Workshop/);
 const h=itemHarness([rows.find(x=>x.sourceRow===170)],{dataset:data});for(const surface of surfaces(h)){const where=required(surface,'.acquisition-enrichment');assert.ok(where.textContent.includes('Ground pickup'));assert.doesNotMatch(where.textContent,/kill|defeat|Ethel|after beating/i);}
});
test('Batch 3 Jeera remains a shop reference while Dammon preserves Act One availability',()=>{
 const jeera=entryFor(byName('Gloves of Dexterity')).routes[0];assert.deepEqual(jeera.coordinates,{x:1380,y:-798,space:"Crèche Y'llek",subject:'location'});assert.equal(jeera.coordinateReview.state,'reference');assert.match(jeera.notes.join(' '),/1387,-821/);
 const dammon=entryFor(byName('Hunting Shortbow')).routes[0];assert.deepEqual(dammon.acts,[1]);assert.match(dammon.conditions.prerequisites[0].subject,/Act One before Dammon leaves/);assert.match(dammon.notes.join(' '),/180,561/);
});
test('Batch 3 vendor conditions do not invent Omeluum, egg, theft or death-drop routes',()=>{
 for(const name of ['Boots of Aid and Comfort','Boots of Genial Striding','Boots of Elemental Momentum','Gloves of Dexterity','Gloves of Missile Snaring','Hunting Shortbow']){
  const routes=entryFor(byName(name)).routes;assert.equal(routes.length,1);assert.equal(routes[0].type,'purchase');assert.deepEqual(routes[0].acts,[1]);assert.doesNotMatch(JSON.stringify(routes[0].conditions),/Omeluum|egg|kill|death|steal|Act Two|Act Three/i);
 }
 assert.equal(entryFor(byName('Boots of Genial Striding')).routes[0].conditions,null);
});
test('Batch 3 corpse pickups keep corpse subjects without live-NPC kill conditions',()=>{
 for(const name of ['Ring of Poison Resistance',"Smuggler's Ring",'Spurred Band']){const r=entryFor(byName(name)).routes[0];assert.equal(r.type,'actor_loot');assert.equal(r.actor.name,'Skeleton');assert.equal(r.coordinates.subject,'corpse');assert.equal(r.conditions,null);}
});
for(const [name,alternate] of [['Gloves of Dexterity','1387,-821'],['Hunting Shortbow','180,561'],['Helmet of Smiting','163,-244'],['Ring of Poison Resistance','338,15'],["Smuggler's Ring",'57,516'],['Staff of Crones','-412,606'],['Skybreaker','27,-298']])test('Batch 3 retains alternate evidence without averaging: '+name,()=>{
 const r=entryFor(byName(name)).routes[0];assert.equal(r.coordinateReview.state,'reference');assert.ok(r.notes.join(' ').includes(alternate));assert.ok(r.coordinateReview.reason.includes(alternate));assert.ok(r.sources.length>=2);
});
test('Batch 3 historical checkpoint includes only approved identities and excludes then-deferred cases',()=>{
 const old=metadata.createResolver(baseline),checkpoint=metadata.createResolver(batch3Snapshot),items=Array.from(itemHarness(catalogue,{dataset:data}).app.items());assert.deepEqual(items.filter(i=>checkpoint.resolve(i)&&!old.resolve(i)).map(key).sort(),approved.map(s=>s.binding.progressKey).sort());
 for(const name of ['Abyss Beckoners',"The Oakfather's Embrace",'Drow Studded Leather Armour',"Winter's Clutches",'Amulet of Misty Step','Amulet of Restoration','Necklace of Elemental Augmentation','Gloves of Hail of Thorns',"Loviatar's Scourge",'The Sparkswall']){const item=items.find(i=>i.act==='ACT 1'&&i.name===name);assert.ok(item,name);assert.equal(checkpoint.resolve(item),null,name);}
});
test('Batch 3 actual catalogue keeps all 555 keys, memberships, Graceful contexts and sourceRow 54 Battlemage',()=>{
 const h=itemHarness(catalogue,{dataset:data}),items=Array.from(h.app.items());assert.equal(catalogue.length,556);assert.equal(items.length,555);assert.deepEqual(items.map(key).sort(),[...new Set(catalogue.map(key))].sort());
 for(const [i,act] of ['ACT 1','ACT 2','ACT 3'].entries()){const a=items.filter(x=>x.act===act);assert.equal(a.filter(h.app.vendor).length,[63,50,67][i]);assert.equal(a.filter(x=>h.app.acquisitionFor(x).loot).length,[131,94,125][i]);assert.equal(a.filter(h.app.quest).length,[25,0,0][i]);}
 const cloth=items.filter(x=>x.name.startsWith('The Graceful Cloth'));assert.equal(cloth.length,2);assert.notEqual(key(cloth[0]),key(cloth[1]));const b=items.filter(x=>x.name==="Gloves of Battlemage's Power");assert.equal(b.length,1);assert.equal(b[0].source,catalogue.find(x=>x.sourceRow===54&&x.name===b[0].name).links.Name);
 const checkpoint=metadata.createResolver(batch3Snapshot),matched=items.filter(i=>checkpoint.resolve(i));assert.equal(matched.length,85);assert.equal(matched.filter(i=>i.act==='ACT 1').length,80);assert.equal(items.filter(i=>i.act==='ACT 1'&&!checkpoint.resolve(i)).length,139);
});
for(const mode of ['full','minimal','light'])test('Batch 3 '+mode+' discovery/filter/sort/count state is unchanged by enrichment',()=>{
 const before=itemHarness(catalogue,{dataset:baseline,mode}),after=itemHarness(catalogue,{dataset:data,mode});assert.deepEqual(clone(discovery(after)),clone(discovery(before)));assert.deepEqual(clone(after.app.items()),clone(before.app.items()));const progress=after.app.progress();
 for(const act of ['ACT 1','ACT 2','ACT 3','ACT 1']){after.act(act);before.act(act);assert.deepEqual(clone(discovery(after)),clone(discovery(before)));}after.search('ring');before.search('ring');assert.deepEqual(clone(discovery(after)),clone(discovery(before)));after.mode('full');after.mode(mode);assert.equal(after.app.progress(),progress);
});
test('Batch 3 protected runtime/schema/resolver/renderer/catalogue/PWA/transport/build files are byte-identical',()=>{
 for(const file of ['index.html','acquisition-metadata.js','acquisition-ui.js','versioned-progress.js','service-worker.js','manifest.json','tests/fixtures/vendor-catalogue.json','tests/fixtures/vendor-membership.json','scripts/build-acquisition-bundle.cjs'])assert.equal(readFileSync(join(root,file),'utf8'),execFileSync('git',['show',base+':'+file],{cwd:root,encoding:'utf8'}),file);
});
test('Batch 3 deterministic generated bundle contains canonical data and unchanged executable logic',()=>{
 assert.equal(generateBundle(),generateBundle());const current=readFileSync(join(root,'assets/acquisition-pilot.js'),'utf8');assert.equal(generateBundle(),current);const embedded=current.match(/  const dataset = (\{[^\n]*\});/);assert.ok(embedded);assert.deepEqual(JSON.parse(embedded[1]),data);
 const prior=execFileSync('git',['show',base+':assets/acquisition-pilot.js'],{cwd:root,encoding:'utf8'});assert.equal(current.replace(/  const dataset = \{[^\n]*\};/,'  const dataset = DATA;'),prior.replace(/  const dataset = \{[^\n]*\};/,'  const dataset = DATA;'));
});
test('Batch 3 actual v5/v6 imports/exports keep exact keys and other Story data isolated',async()=>{
 const h=storyHarness({userId:null,stories:[{id:'A',name:'Local A',local:true},{id:'B',name:'Local B',local:true}]});h.seed('A',{});h.seed('B',{'other-story':record('skipped')});await h.app.activate('A',{sync:false});
 for(const version of [5,6]){const items=Object.fromEntries(approved.map((s,i)=>[s.binding.progressKey,version===5?'found':i%2?'skipped':'found']));const input=version===5?{progress:Object.fromEntries(approved.map(s=>['ACT 1|'+s.name,true]))}:{formatVersion:2,items};await h.app.import(input,'merge');const output=await h.exportPayload();assert.deepEqual(output.items,items);assert.equal(h.cached('B')['other-story'].status,'skipped');}
});
