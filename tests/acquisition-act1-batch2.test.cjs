/* Batch 2: literal reviewed identities and points; production resolver/render/import paths. */
'use strict';
const withoutAct2Continuations=require('./helpers/acquisition-checkpoint.cjs');
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const {readFileSync}=require('node:fs'),{join}=require('node:path'),{execFileSync}=require('node:child_process');
const metadata=require('../acquisition-metadata.js'),{createAcquisitionUI}=require('../acquisition-ui.js'),{generateBundle}=require('../scripts/build-acquisition-bundle.cjs');
const {harness:storyHarness,record}=require('./helpers/app-harness.cjs');
const root=join(__dirname,'..'),base='2087779449092caf968e1a07f11943d480018990';
const baseline=JSON.parse(execFileSync('git',['show',base+':data/acquisition.v1.json'],{cwd:root,encoding:'utf8'}));
const data=JSON.parse(readFileSync(join(root,'data/acquisition.v1.json'),'utf8'));
const batch2Snapshot=JSON.parse(execFileSync('git',['show','5a1edf08a52803a502a13e740f3a9ba8276cd2f6:data/acquisition.v1.json'],{cwd:root,encoding:'utf8'}));
const batch2IDs=new Set(batch2Snapshot.entries.map(e=>e.id));
const catalogue=JSON.parse(readFileSync(join(__dirname,'fixtures/vendor-catalogue.json'),'utf8'));
const clone=x=>JSON.parse(JSON.stringify(x)),key=x=>(x.act+'|'+x.name).toLowerCase();
// Allocated once and pinned before canonical Batch 2 metadata was added.
const approved = [
  {
    "name": "Helmet of Autonomy",
    "sourceRow": 94,
    "source": "https://bg3.wiki/wiki/Helmet_of_Autonomy",
    "entryId": "8611acab-ae1f-4160-976b-f532f096f6d3",
    "coverage": "reviewed",
    "binding": {
      "id": "1a524618-86fc-4abd-b80d-e4238bbc410e",
      "act": "ACT 1",
      "progressKey": "act 1|helmet of autonomy",
      "gameIds": [
        "UND_FairyRings_AntiCharmHelmet",
        "UND_FairyRing_AntiCharmHelmet"
      ],
      "wikiPage": "Helmet of Autonomy"
    },
    "routes": [
      {
        "id": "c104f0ad-56ab-46a9-a226-226bd4717584",
        "type": "actor_loot",
        "acts": [
          1
        ],
        "actor": {
          "name": "Skeleton"
        },
        "location": {
          "name": "Underdark",
          "wikiPage": "Underdark"
        },
        "sublocation": "Skeleton above the Festering Cove entrance",
        "coordinates": {
          "x": 82,
          "y": -241,
          "space": "Underdark",
          "subject": "corpse"
        },
        "conditions": null,
        "notes": [
          "The skeleton is outside the cove, in the Underdark. The entrance at 70,-240 is a different subject and is not substituted."
        ],
        "validity": "current",
        "sources": [
          {
            "url": "https://bg3.wiki/w/index.php?title=Helmet_of_Autonomy&oldid=419473",
            "revisionId": 419473,
            "section": "Where to find; Notes"
          },
          {
            "url": "https://bg3.wiki/w/index.php?title=The_Festering_Cove&oldid=408749",
            "revisionId": 408749,
            "section": "Access"
          }
        ],
        "review": {
          "state": "reviewed",
          "reviewedAt": "2026-10-17",
          "reviewer": "Codex BG3 Wiki primary-source Batch 2 review"
        },
        "coordinateReview": {
          "state": "exact"
        }
      }
    ]
  },
  {
    "name": "Slippery Chain Shirt",
    "sourceRow": 159,
    "source": "https://bg3.wiki/wiki/Slippery_Chain_Shirt",
    "entryId": "e10f6f76-ec5a-436f-9db4-bdebbc5d71ac",
    "coverage": "reviewed",
    "binding": {
      "id": "3629c5e9-5961-465b-a265-835091e74138",
      "act": "ACT 1",
      "progressKey": "act 1|slippery chain shirt",
      "gameIds": [
        "MAG_Healer_DisengageOnHeal_ChainShirt"
      ],
      "wikiPage": "Slippery Chain Shirt"
    },
    "routes": [
      {
        "id": "a116540e-b63a-459e-8676-628b40587f1d",
        "type": "container",
        "acts": [
          1
        ],
        "actor": null,
        "location": {
          "name": "The Festering Cove",
          "wikiPage": "The Festering Cove"
        },
        "sublocation": "Locked, trapped chest on the cliff behind the altar",
        "coordinates": {
          "x": -400,
          "y": 329,
          "space": "The Festering Cove",
          "subject": "container"
        },
        "conditions": null,
        "notes": [
          "Mushroom platforms approach the cliff. The access point -401,311 is not the chest coordinate. No BOOOAL outcome is a prerequisite."
        ],
        "validity": "current",
        "sources": [
          {
            "url": "https://bg3.wiki/w/index.php?title=Slippery_Chain_Shirt&oldid=423304",
            "revisionId": 423304,
            "section": "Where to find; Notes"
          },
          {
            "url": "https://bg3.wiki/w/index.php?title=The_Festering_Cove&oldid=408749",
            "revisionId": 408749,
            "section": "Overview"
          }
        ],
        "review": {
          "state": "reviewed",
          "reviewedAt": "2026-10-17",
          "reviewer": "Codex BG3 Wiki primary-source Batch 2 review"
        },
        "coordinateReview": {
          "state": "exact"
        }
      }
    ]
  },
  {
    "name": "Explorer's Ring",
    "sourceRow": 65,
    "source": "https://bg3.wiki/wiki/Explorer's_Ring",
    "entryId": "1965d424-1691-43e2-bedc-e8327126e6b3",
    "coverage": "reviewed",
    "binding": {
      "id": "489d6244-7324-404e-b5f4-5f62cae7ebd1",
      "act": "ACT 1",
      "progressKey": "act 1|explorer's ring",
      "gameIds": [
        "UND_MushroomHunter_RingOfExploration",
        "UND_MushroomHunger_RingOfExploration"
      ],
      "wikiPage": "Explorer's Ring"
    },
    "routes": [
      {
        "id": "420ff375-75cb-4cf1-b792-77d1d7989a04",
        "type": "actor_loot",
        "acts": [
          1
        ],
        "actor": {
          "name": "Skeleton"
        },
        "location": {
          "name": "Dread Hollow",
          "wikiPage": "Dread Hollow"
        },
        "sublocation": "Skeleton on a ledge above the Bibberbang Grotto",
        "coordinates": {
          "x": -12,
          "y": -50,
          "space": "Dread Hollow",
          "subject": "corpse"
        },
        "conditions": null,
        "notes": [
          "The skeleton is not highlighted by Alt. High Strength or enhanced jumping are access options, not mandatory character requirements."
        ],
        "validity": "current",
        "sources": [
          {
            "url": "https://bg3.wiki/w/index.php?title=Explorer%27s_Ring&oldid=418328",
            "revisionId": 418328,
            "section": "Where to find; Notes"
          },
          {
            "url": "https://bg3.wiki/w/index.php?title=Dread_Hollow&oldid=417935",
            "revisionId": 417935,
            "section": "Bibberbang Grotto"
          }
        ],
        "review": {
          "state": "reviewed",
          "reviewedAt": "2026-10-17",
          "reviewer": "Codex BG3 Wiki primary-source Batch 2 review"
        },
        "coordinateReview": {
          "state": "exact"
        }
      }
    ]
  },
  {
    "name": "The Joltshooter",
    "sourceRow": 189,
    "source": "https://bg3.wiki/wiki/The_Joltshooter",
    "entryId": "697bdf7c-be2b-4eff-96da-88a82ffbd92e",
    "coverage": "reviewed",
    "binding": {
      "id": "17d3513c-5dab-441e-947a-d5c8f4dedd41",
      "act": "ACT 1",
      "progressKey": "act 1|the joltshooter",
      "gameIds": [
        "MAG_ChargedLightning_Longbow"
      ],
      "wikiPage": "The Joltshooter"
    },
    "routes": [
      {
        "id": "c012f306-da9f-43cc-b1e0-14773d49bfcf",
        "type": "quest_reward",
        "acts": [
          1
        ],
        "actor": {
          "name": "Counsellor Florrick",
          "wikiPage": "Florrick"
        },
        "location": {
          "name": "Waukeen's Rest",
          "wikiPage": "Waukeen's Rest"
        },
        "sublocation": "Post-rescue conversation",
        "coordinates": {
          "x": -63,
          "y": 600,
          "space": "Waukeen's Rest",
          "subject": "interaction"
        },
        "conditions": {
          "prerequisites": [
            {
              "kind": "interaction",
              "subject": "Rescue Counsellor Florrick",
              "value": "Save her from the burning inn and speak outside."
            },
            {
              "kind": "choice",
              "subject": "Choose The Joltshooter",
              "value": "One of three mutually exclusive rewards; not The Spellsparkler or The Sparky Points."
            }
          ],
          "before": [
            {
              "kind": "interaction",
              "subject": "Rescue before the fire advances",
              "value": "After entering the inner yard, do not leave for camp, fast travel or long rest before the rescue."
            }
          ]
        },
        "notes": [
          "Rescuing Florrick gives one weapon choice. Completing the later Duke rescue or agreeing to it is not a prerequisite."
        ],
        "validity": "current",
        "sources": [
          {
            "url": "https://bg3.wiki/w/index.php?title=The_Joltshooter&oldid=424041",
            "revisionId": 424041,
            "section": "Where to find; Notes"
          },
          {
            "url": "https://bg3.wiki/w/index.php?title=Florrick&oldid=431924",
            "revisionId": 431924,
            "section": "Involvement / Act One"
          },
          {
            "url": "https://bg3.wiki/w/index.php?title=Waukeen%27s_Rest&oldid=424793",
            "revisionId": 424793,
            "section": "Florrick and the Grand Duke; Quest rewards; Notes"
          },
          {
            "url": "https://bg3.wiki/w/index.php?title=Rescue_the_Grand_Duke&oldid=408690",
            "revisionId": 408690,
            "section": "Waukeen's Rest; Quest rewards"
          }
        ],
        "review": {
          "state": "reviewed",
          "reviewedAt": "2026-10-17",
          "reviewer": "Codex BG3 Wiki primary-source Batch 2 review"
        },
        "coordinateReview": {
          "state": "exact"
        }
      }
    ]
  },
  {
    "name": "Robe of Summer",
    "sourceRow": 146,
    "source": "https://bg3.wiki/wiki/Robe_of_Summer",
    "entryId": "15c273ee-5f1d-4afc-a9c9-a8841b62a158",
    "coverage": "reviewed",
    "binding": {
      "id": "19a154fa-14ae-47ac-a73d-861a11b8a3b9",
      "act": "ACT 1",
      "progressKey": "act 1|robe of summer",
      "gameIds": [
        "UNI_RobeOfSummer"
      ],
      "wikiPage": "Robe of Summer"
    },
    "routes": [
      {
        "id": "35802ea9-403c-4837-ab0a-6072d7997070",
        "type": "container",
        "acts": [
          1
        ],
        "actor": null,
        "location": {
          "name": "Hidden Vault",
          "wikiPage": "Hidden Vault"
        },
        "sublocation": "Side container beside the altar",
        "coordinates": {
          "x": 183,
          "y": -82,
          "space": "Hidden Vault",
          "subject": "container"
        },
        "conditions": {
          "prerequisites": [
            {
              "kind": "item",
              "subject": "Rune of the Wolf"
            },
            {
              "kind": "interaction",
              "subject": "Open the Hidden Vault",
              "value": "Place the rune and activate all four pedestals."
            }
          ]
        },
        "notes": [
          "The item page calls the container a crate; Inner Sanctum calls it a trunk to the side. The Rune can be rewarded, looted or pickpocketed; rescuing Halsin is not the sole access route."
        ],
        "validity": "current",
        "sources": [
          {
            "url": "https://bg3.wiki/w/index.php?title=Robe_of_Summer&oldid=422437",
            "revisionId": 422437,
            "section": "Where to find; Notes"
          },
          {
            "url": "https://bg3.wiki/w/index.php?title=Inner_Sanctum&oldid=419777",
            "revisionId": 419777,
            "section": "Enclave Library; Hidden Vault"
          },
          {
            "url": "https://bg3.wiki/w/index.php?title=Rune_of_the_Wolf&oldid=422520",
            "revisionId": 422520,
            "section": "Where to find"
          }
        ],
        "review": {
          "state": "reviewed",
          "reviewedAt": "2026-10-17",
          "reviewer": "Codex BG3 Wiki primary-source Batch 2 review"
        },
        "coordinateReview": {
          "state": "reference",
          "reason": "Item-page vault/container reference shared with the altar point; not a separately surveyed crate position."
        }
      }
    ]
  },
  {
    "name": "Armour of Uninhibited Kushigo",
    "sourceRow": 18,
    "source": "https://bg3.wiki/wiki/Armour_of_Uninhibited_Kushigo",
    "entryId": "06015a47-519f-483d-b6bc-eb38c644b344",
    "coverage": "reviewed",
    "binding": {
      "id": "b637a4e7-e6b1-442f-a21c-db78476d3850",
      "act": "ACT 1",
      "progressKey": "act 1|armour of uninhibited kushigo",
      "gameIds": [
        "MAG_Monk_Magic_Armor"
      ],
      "wikiPage": "Armour of Uninhibited Kushigo"
    },
    "routes": [
      {
        "id": "70e51de6-b3d2-49ca-9c70-3eb30fa49d0d",
        "type": "quest_reward",
        "acts": [
          1
        ],
        "actor": {
          "name": "Sergeant Thrinn",
          "wikiPage": "Elenna Thrinn"
        },
        "location": {
          "name": "Grymforge",
          "wikiPage": "Grymforge"
        },
        "sublocation": "Sergeant Thrinn near the cave-in",
        "coordinates": {
          "x": -628,
          "y": 320,
          "space": "Grymforge",
          "subject": "encounter"
        },
        "conditions": {
          "prerequisites": [
            {
              "kind": "quest",
              "subject": "Find the Missing Boots",
              "value": "Return Boots of Speed to Sergeant Thrinn while she is available."
            },
            {
              "kind": "choice",
              "subject": "Choose Armour of Uninhibited Kushigo",
              "value": "Alternative to Bracing Band."
            }
          ]
        },
        "notes": [
          "The item-page reward reference is -628,320; Elenna Thrinn gives -643,300 and the quest gives the cave-in -626,331. No point is averaged or represented as a fixed actor location. Freeing Nere is not a reward prerequisite."
        ],
        "validity": "current",
        "sources": [
          {
            "url": "https://bg3.wiki/w/index.php?title=Armour_of_Uninhibited_Kushigo&oldid=416072",
            "revisionId": 416072,
            "section": "Where to find; Notes"
          },
          {
            "url": "https://bg3.wiki/w/index.php?title=Elenna_Thrinn&oldid=425977",
            "revisionId": 425977,
            "section": "Involvement"
          },
          {
            "url": "https://bg3.wiki/w/index.php?title=Find_the_Missing_Boots&oldid=418496",
            "revisionId": 418496,
            "section": "Talk to Sergeant Thrinn; Quest rewards"
          },
          {
            "url": "https://bg3.wiki/w/index.php?title=Grymforge&oldid=433400",
            "revisionId": 433400,
            "section": "Sergeant Thrinn and the gnome slaves"
          }
        ],
        "review": {
          "state": "reviewed",
          "reviewedAt": "2026-10-17",
          "reviewer": "Codex BG3 Wiki primary-source Batch 2 review"
        },
        "coordinateReview": {
          "state": "reference",
          "reason": "Item-page reward encounter reference; NPC and quest pages publish different nearby positions."
        }
      }
    ]
  },
  {
    "name": "Aberration Hunters' Amulet",
    "sourceRow": 2,
    "source": "https://bg3.wiki/wiki/Aberration_Hunters'_Amulet",
    "entryId": "3809df0a-fc9d-4ab2-9473-6610ad441464",
    "coverage": "reviewed",
    "binding": {
      "id": "3ac7519d-5e76-4cf4-9846-b215b47e007a",
      "act": "ACT 1",
      "progressKey": "act 1|aberration hunters' amulet",
      "gameIds": [
        "CRE_MAG_Githborn_Amulet"
      ],
      "wikiPage": "Aberration Hunters' Amulet"
    },
    "routes": [
      {
        "id": "20e39cd4-9853-4328-a6a1-997eae981584",
        "type": "actor_loot",
        "acts": [
          1
        ],
        "actor": {
          "name": "Ghustil Stornugoss",
          "wikiPage": "Stornugoss"
        },
        "location": {
          "name": "Crèche Y'llek",
          "wikiPage": "Crèche Y'llek"
        },
        "sublocation": "Doctor's Office",
        "coordinates": {
          "x": 1285,
          "y": -801,
          "space": "Crèche Y'llek",
          "subject": "encounter"
        },
        "conditions": null,
        "notes": [
          "Item point 1285,-801; NPC page 1286,-800; crèche character list 1286,-801. The office entrance 1289,-809 is a different subject. No treatment or Githyanki requirement is added to acquisition."
        ],
        "validity": "current",
        "sources": [
          {
            "url": "https://bg3.wiki/w/index.php?title=Aberration_Hunters%27_Amulet&oldid=415736",
            "revisionId": 415736,
            "section": "Where to find; Notes"
          },
          {
            "url": "https://bg3.wiki/w/index.php?title=Stornugoss&oldid=425242",
            "revisionId": 425242,
            "section": "Involvement; Loot"
          },
          {
            "url": "https://bg3.wiki/w/index.php?title=Cr%C3%A8che_Y%27llek&oldid=417426",
            "revisionId": 417426,
            "section": "Doctor's Office; Characters"
          }
        ],
        "review": {
          "state": "reviewed",
          "reviewedAt": "2026-10-17",
          "reviewer": "Codex BG3 Wiki primary-source Batch 2 review"
        },
        "coordinateReview": {
          "state": "reference",
          "reason": "Item-page encounter reference; the NPC page and crèche character list give nearby, differing actor points."
        }
      }
    ]
  },
  {
    "name": "Ritual Axe",
    "sourceRow": 144,
    "source": "https://bg3.wiki/wiki/Ritual_Axe",
    "entryId": "45007dab-5a69-4b83-a090-6fd30f69b799",
    "coverage": "reviewed",
    "binding": {
      "id": "08bbe2c7-e516-440e-9f29-df25b72529b6",
      "act": "ACT 1",
      "progressKey": "act 1|ritual axe",
      "gameIds": [
        "WPN_GOB_PainPriest_Handaxe",
        "GOB_PainPriest_Handaxe"
      ],
      "wikiPage": "Ritual Axe"
    },
    "routes": [
      {
        "id": "f46448bc-57e3-4664-9705-297557b3f712",
        "type": "world",
        "acts": [
          1
        ],
        "actor": null,
        "location": {
          "name": "Shattered Sanctum",
          "wikiPage": "Shattered Sanctum"
        },
        "sublocation": "Bloodied Shrine table beside Abdirak",
        "coordinates": {
          "x": 338,
          "y": -26,
          "space": "Shattered Sanctum",
          "subject": "item"
        },
        "conditions": {
          "before": [
            {
              "kind": "interaction",
              "subject": "Abdirak collects his tools",
              "value": "Table pickup is available before he gathers the axe to leave."
            }
          ]
        },
        "notes": [
          "The item page gives 338,-26; Shattered Sanctum gives 337,-26 for the table. Keep the item reference without averaging. Abdirak may later carry the axe away. No penance or blessing is required."
        ],
        "validity": "current",
        "sources": [
          {
            "url": "https://bg3.wiki/w/index.php?title=Ritual_Axe&oldid=422414",
            "revisionId": 422414,
            "section": "Where to find; Notes"
          },
          {
            "url": "https://bg3.wiki/w/index.php?title=Shattered_Sanctum&oldid=431013",
            "revisionId": 431013,
            "section": "Notable loot"
          },
          {
            "url": "https://bg3.wiki/w/index.php?title=Abdirak&oldid=430717",
            "revisionId": 430717,
            "section": "Involvement"
          }
        ],
        "review": {
          "state": "reviewed",
          "reviewedAt": "2026-10-17",
          "reviewer": "Codex BG3 Wiki primary-source Batch 2 review"
        },
        "coordinateReview": {
          "state": "reference",
          "reason": "Item-page table reference; Shattered Sanctum gives the table as 337,-26."
        }
      },
      {
        "id": "f41beb97-95ea-4c86-b1d5-3849caedceae",
        "type": "actor_loot",
        "acts": [
          1
        ],
        "actor": {
          "name": "Abdirak",
          "wikiPage": "Abdirak"
        },
        "location": {
          "name": "Shattered Sanctum",
          "wikiPage": "Shattered Sanctum"
        },
        "sublocation": "Bloodied Shrine departure encounter",
        "coordinates": {
          "x": 334,
          "y": -21,
          "space": "Shattered Sanctum",
          "subject": "location"
        },
        "conditions": {
          "prerequisites": [
            {
              "kind": "interaction",
              "subject": "Abdirak has collected the axe",
              "value": "He carries his tools when leaving after the goblin-leader conflict; must still be available."
            }
          ]
        },
        "notes": [
          "The Abdirak page explicitly says he carries the Ritual Axe from the shrine when leaving. The shrine point 334,-21 is a labelled navigation reference, not his moving position. This carried route remains separate from the table pickup; no specific theft or kill requirement is inferred."
        ],
        "validity": "current",
        "sources": [
          {
            "url": "https://bg3.wiki/w/index.php?title=Ritual_Axe&oldid=422414",
            "revisionId": 422414,
            "section": "Where to find; Notes"
          },
          {
            "url": "https://bg3.wiki/w/index.php?title=Abdirak&oldid=430717",
            "revisionId": 430717,
            "section": "Involvement"
          },
          {
            "url": "https://bg3.wiki/w/index.php?title=Bloodied_Shrine&oldid=430720",
            "revisionId": 430720,
            "section": "Lead"
          }
        ],
        "review": {
          "state": "reviewed",
          "reviewedAt": "2026-10-17",
          "reviewer": "Codex BG3 Wiki primary-source Batch 2 review"
        },
        "coordinateReview": {
          "state": "reference",
          "reason": "Bloodied Shrine navigation reference, not a fixed position for departing Abdirak."
        }
      }
    ]
  },
  {
    "name": "Sussur Dagger",
    "sourceRow": 174,
    "source": "https://bg3.wiki/wiki/Sussur_Dagger",
    "entryId": "5a12b209-dd90-466e-9b7f-00723b11fa8e",
    "coverage": "reviewed",
    "binding": {
      "id": "7e1b46e6-9b8c-4e5b-b53a-823f21a1affb",
      "act": "ACT 1",
      "progressKey": "act 1|sussur dagger",
      "gameIds": [
        "QUEST_FOR_SussurDagger",
        "FOR_IncompleteMasterwork_SussurDagger"
      ],
      "wikiPage": "Sussur Dagger"
    },
    "routes": [
      {
        "id": "0b874eb2-c5ae-441b-ab54-2420f0c4f2f8",
        "type": "craft",
        "acts": [
          1
        ],
        "actor": null,
        "location": {
          "name": "Blighted Village",
          "wikiPage": "Blighted Village"
        },
        "sublocation": "Smithy's cellar furnace",
        "coordinates": {
          "x": -446,
          "y": -378,
          "space": "Blighted Village",
          "subject": "crafting_station"
        },
        "conditions": {
          "prerequisites": [
            {
              "kind": "item",
              "subject": "Sussur Tree Bark"
            },
            {
              "kind": "item",
              "subject": "Plain non-magical Dagger"
            },
            {
              "kind": "interaction",
              "subject": "Use the smithy furnace",
              "value": "Light the furnace, add bark, then the dagger."
            }
          ]
        },
        "notes": [
          "The quest explicitly locates the furnace at -446,-378; the item acquisition area is -477,-378. Use the furnace reference without claiming exact agreement. A plain compatible dagger is required; some non-standard daggers cannot be used. This is crafting, not an additional quest reward route."
        ],
        "validity": "current",
        "sources": [
          {
            "url": "https://bg3.wiki/w/index.php?title=Sussur_Dagger&oldid=438507",
            "revisionId": 438507,
            "section": "Where to find; Notes"
          },
          {
            "url": "https://bg3.wiki/w/index.php?title=Finish_the_Masterwork_Weapon&oldid=438508",
            "revisionId": 438508,
            "section": "Forging; Quest rewards"
          },
          {
            "url": "https://bg3.wiki/w/index.php?title=Blighted_Village&oldid=433668",
            "revisionId": 433668,
            "section": "Blacksmith's house"
          }
        ],
        "review": {
          "state": "reviewed",
          "reviewedAt": "2026-10-17",
          "reviewer": "Codex BG3 Wiki primary-source Batch 2 review"
        },
        "coordinateReview": {
          "state": "reference",
          "reason": "Quest-documented furnace reference; the item page uses a different acquisition-area point."
        }
      }
    ]
  },
  {
    "name": "Sorrow",
    "sourceRow": 161,
    "source": "https://bg3.wiki/wiki/Sorrow",
    "entryId": "4e49579c-7de2-417b-8190-0a67cdf2b543",
    "coverage": "reviewed",
    "binding": {
      "id": "1c9fc71a-7690-450a-b76f-00e5d04e41ae",
      "act": "ACT 1",
      "progressKey": "act 1|sorrow",
      "gameIds": [
        "UNI_DEN_HalsinBlade",
        "DEN_HalsinBlade"
      ],
      "wikiPage": "Sorrow"
    },
    "routes": [
      {
        "id": "dd94ea09-0737-4ffd-b240-05e0ea3c8b23",
        "type": "world",
        "acts": [
          1
        ],
        "actor": null,
        "location": {
          "name": "Hidden Vault",
          "wikiPage": "Hidden Vault"
        },
        "sublocation": "Stone slab at the Wolf altar",
        "coordinates": {
          "x": 183,
          "y": -82,
          "space": "Hidden Vault",
          "subject": "item"
        },
        "conditions": {
          "prerequisites": [
            {
              "kind": "item",
              "subject": "Rune of the Wolf"
            },
            {
              "kind": "interaction",
              "subject": "Open the Hidden Vault",
              "value": "Place the rune and activate all four pedestals."
            }
          ]
        },
        "notes": [
          "Access uses the Rune of the Wolf and library pedestals. Reward, loot and pickpocket are ways to obtain the rune, not separate routes that create Sorrow. No mandatory Halsin-rescue branch is introduced."
        ],
        "validity": "current",
        "sources": [
          {
            "url": "https://bg3.wiki/w/index.php?title=Sorrow&oldid=426894",
            "revisionId": 426894,
            "section": "Where to find; Notes"
          },
          {
            "url": "https://bg3.wiki/w/index.php?title=Inner_Sanctum&oldid=419777",
            "revisionId": 419777,
            "section": "Enclave Library; Hidden Vault"
          },
          {
            "url": "https://bg3.wiki/w/index.php?title=Rune_of_the_Wolf&oldid=422520",
            "revisionId": 422520,
            "section": "Where to find"
          }
        ],
        "review": {
          "state": "reviewed",
          "reviewedAt": "2026-10-17",
          "reviewer": "Codex BG3 Wiki primary-source Batch 2 review"
        },
        "coordinateReview": {
          "state": "reference",
          "reason": "Item-page altar reference shared with the vault container point; retained as navigation rather than a surveyed object position."
        }
      }
    ]
  },
  {
    "name": "The Watcher's Guide",
    "sourceRow": 203,
    "source": "https://bg3.wiki/wiki/The_Watcher's_Guide",
    "entryId": "df5fa78a-9002-4c27-95dd-9f8d05af64c3",
    "coverage": "reviewed",
    "binding": {
      "id": "a653e118-9b94-4969-939a-5b9b206ee9cf",
      "act": "ACT 1",
      "progressKey": "act 1|the watcher's guide",
      "gameIds": [
        "CHA_CompassSpear"
      ],
      "wikiPage": "The Watcher's Guide"
    },
    "routes": [
      {
        "id": "4168d325-da02-4170-9ba2-3b3ecd2fa333",
        "type": "container",
        "acts": [
          1
        ],
        "actor": null,
        "location": {
          "name": "Dank Crypt",
          "wikiPage": "Dank Crypt"
        },
        "sublocation": "Central sarcophagus surrounded by statues and traps",
        "coordinates": {
          "x": -293,
          "y": -323,
          "space": "Dank Crypt",
          "subject": "container"
        },
        "conditions": null,
        "notes": [
          "Overgrown Ruins locates the southern room at -293,-325; that room anchor is not substituted for the item-page sarcophagus point. No trap-disarming check is made mandatory."
        ],
        "validity": "current",
        "sources": [
          {
            "url": "https://bg3.wiki/w/index.php?title=The_Watcher%27s_Guide&oldid=424151",
            "revisionId": 424151,
            "section": "Where to find; Notes"
          },
          {
            "url": "https://bg3.wiki/w/index.php?title=Overgrown_Ruins&oldid=434111",
            "revisionId": 434111,
            "section": "Dank Crypt / Southern room"
          }
        ],
        "review": {
          "state": "reviewed",
          "reviewedAt": "2026-10-17",
          "reviewer": "Codex BG3 Wiki primary-source Batch 2 review"
        },
        "coordinateReview": {
          "state": "exact"
        }
      }
    ]
  },
  {
    "name": "Wondrous Gloves",
    "sourceRow": 217,
    "source": "https://bg3.wiki/wiki/Wondrous_Gloves",
    "entryId": "da342b39-8092-44c6-89a9-c6e27778a123",
    "coverage": "reviewed",
    "binding": {
      "id": "0e48db29-2b5c-460c-98b0-7bfcfaba06fb",
      "act": "ACT 1",
      "progressKey": "act 1|wondrous gloves",
      "gameIds": [
        "MAG_BG_Wondrous_Gloves"
      ],
      "wikiPage": "Wondrous Gloves"
    },
    "routes": [
      {
        "id": "e7e3e82b-bd28-46e3-93f6-0a666e7509b5",
        "type": "actor_loot",
        "acts": [
          1
        ],
        "actor": {
          "name": "Mimic"
        },
        "location": {
          "name": "Grymforge",
          "wikiPage": "Grymforge"
        },
        "sublocation": "Mimics near the Harper cache",
        "coordinates": {
          "x": -691,
          "y": 374,
          "space": "Grymforge",
          "subject": "encounter"
        },
        "conditions": null,
        "notes": [
          "These gloves are carried by one of the mimics, not the separate Harper Stash. Detecting the disguise with Perception is optional; no DC is an acquisition prerequisite."
        ],
        "validity": "current",
        "sources": [
          {
            "url": "https://bg3.wiki/w/index.php?title=Wondrous_Gloves&oldid=424969",
            "revisionId": 424969,
            "section": "Where to find; Notes"
          },
          {
            "url": "https://bg3.wiki/w/index.php?title=Grymforge&oldid=433400",
            "revisionId": 433400,
            "section": "Hidden treasure"
          }
        ],
        "review": {
          "state": "reviewed",
          "reviewedAt": "2026-10-17",
          "reviewer": "Codex BG3 Wiki primary-source Batch 2 review"
        },
        "coordinateReview": {
          "state": "reference",
          "reason": "Item-page mimic encounter reference; not a chest-container or fixed moving actor position."
        }
      }
    ]
  },
  {
    "name": "Ring of Arcane Synergy",
    "sourceRow": 133,
    "source": "https://bg3.wiki/wiki/Ring_of_Arcane_Synergy",
    "entryId": "9db3446c-e93b-48ab-ba7b-083d4021c1cf",
    "coverage": "reviewed",
    "binding": {
      "id": "7ec0f442-e693-44ca-9aa6-a8272e5843f8",
      "act": "ACT 1",
      "progressKey": "act 1|ring of arcane synergy",
      "gameIds": [
        "MAG_Gish_ArcaneSynergy_Ring"
      ],
      "wikiPage": "Ring of Arcane Synergy"
    },
    "routes": [
      {
        "id": "f00bea0b-994e-48ae-8f44-b3c6f7f692e2",
        "type": "actor_loot",
        "acts": [
          1
        ],
        "actor": {
          "name": "Gish Far'aag",
          "wikiPage": "Far'aag"
        },
        "location": {
          "name": "Crèche Y'llek",
          "wikiPage": "Crèche Y'llek"
        },
        "sublocation": "Main entrance checkpoint",
        "coordinates": {
          "x": 1359,
          "y": -831,
          "space": "Crèche Y'llek",
          "subject": "encounter"
        },
        "conditions": null,
        "notes": [
          "Carried by the guard at the entryway. No mandatory dialogue, artefact handover, combat initiation or character ancestry is inferred."
        ],
        "validity": "current",
        "sources": [
          {
            "url": "https://bg3.wiki/w/index.php?title=Ring_of_Arcane_Synergy&oldid=438176",
            "revisionId": 438176,
            "section": "Where to find; Notes"
          },
          {
            "url": "https://bg3.wiki/w/index.php?title=Far%27aag&oldid=425586",
            "revisionId": 425586,
            "section": "Involvement / Act One; Loot"
          }
        ],
        "review": {
          "state": "reviewed",
          "reviewedAt": "2026-10-17",
          "reviewer": "Codex BG3 Wiki primary-source Batch 2 review"
        },
        "coordinateReview": {
          "state": "reference",
          "reason": "Item-page guard encounter reference; not a fixed position for the moving actor."
        }
      }
    ]
  },
  {
    "name": "Strange Conduit Ring",
    "sourceRow": 172,
    "source": "https://bg3.wiki/wiki/Strange_Conduit_Ring",
    "entryId": "9e3697dc-ec4c-488d-aa34-4a5106659a63",
    "coverage": "reviewed",
    "binding": {
      "id": "fc54a7bc-d269-433a-8774-b7ac7cb4a8ef",
      "act": "ACT 1",
      "progressKey": "act 1|strange conduit ring",
      "gameIds": [
        "MAG_Gish_PsychicDamageBonusWhileConcentrating_Ring"
      ],
      "wikiPage": "Strange Conduit Ring"
    },
    "routes": [
      {
        "id": "83de956f-b1f6-4ec1-8c5a-2eac7e58aecc",
        "type": "container",
        "acts": [
          1
        ],
        "actor": null,
        "location": {
          "name": "Crèche Y'llek",
          "wikiPage": "Crèche Y'llek"
        },
        "sublocation": "Elegant chest in the Inquisitor's Chamber",
        "coordinates": {
          "x": 1360,
          "y": -657,
          "space": "Crèche Y'llek",
          "subject": "container"
        },
        "conditions": null,
        "notes": [
          "The chamber entrance 1357,-685 is not substituted for the chest. No Inquisitor-kill prerequisite is inferred."
        ],
        "validity": "current",
        "sources": [
          {
            "url": "https://bg3.wiki/w/index.php?title=Strange_Conduit_Ring&oldid=423637",
            "revisionId": 423637,
            "section": "Where to find; Notes"
          },
          {
            "url": "https://bg3.wiki/w/index.php?title=Cr%C3%A8che_Y%27llek&oldid=417426",
            "revisionId": 417426,
            "section": "Inquisitor's Chamber; Notable loot"
          }
        ],
        "review": {
          "state": "reviewed",
          "reviewedAt": "2026-10-17",
          "reviewer": "Codex BG3 Wiki primary-source Batch 2 review"
        },
        "coordinateReview": {
          "state": "exact"
        }
      }
    ]
  },
  {
    "name": "Sunwalker's Gift",
    "sourceRow": 173,
    "source": "https://bg3.wiki/wiki/Sunwalker's_Gift",
    "entryId": "f5254339-0640-4849-9c58-f593f2daa7e5",
    "coverage": "reviewed",
    "binding": {
      "id": "f70f908c-2de3-4461-83a4-446f4ccb73c8",
      "act": "ACT 1",
      "progressKey": "act 1|sunwalker's gift",
      "gameIds": [
        "UNI_UND_SocietyOfBrilliance_DarkvisionRing",
        "UND_SocietyOfBrilliance_DarkvisionRing"
      ],
      "wikiPage": "Sunwalker's Gift"
    },
    "routes": [
      {
        "id": "3fb986a6-ff89-446f-9bf3-896a3200fec7",
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
          "Blurg and the item page agree on 111,-89 in Act One. No Omeluum quest or tadpole disclosure is required to buy the ring; later Act appearances do not create catalogue bindings."
        ],
        "validity": "current",
        "sources": [
          {
            "url": "https://bg3.wiki/w/index.php?title=Sunwalker%27s_Gift&oldid=423716",
            "revisionId": 423716,
            "section": "Where to find; Notes"
          },
          {
            "url": "https://bg3.wiki/w/index.php?title=Blurg&oldid=434059",
            "revisionId": 434059,
            "section": "Involvement / Act One; Notable items sold"
          }
        ],
        "review": {
          "state": "reviewed",
          "reviewedAt": "2026-10-17",
          "reviewer": "Codex BG3 Wiki primary-source Batch 2 review"
        },
        "coordinateReview": {
          "state": "reference",
          "reason": "Reviewed Act One trader encounter reference; Blurg may move."
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
const entryFor=s=>{const e=data.entries.find(e=>e.id===s.entryId);assert.ok(e,'Missing reviewed Batch 2 entry: '+s.name);return e};
function browser(source=readFileSync(join(root,'assets/acquisition-pilot.js'),'utf8')){
 const calls=[],blocked=name=>()=>{calls.push(name);throw Error('Unexpected '+name)};
 const sandbox={URL,fetch:blocked('network'),setTimeout:blocked('timer'),document:new Proxy({},{get:blocked('DOM')}),localStorage:new Proxy({},{get:blocked('storage')})};
 sandbox.window=sandbox;vm.runInNewContext(source,sandbox);return {ui:sandbox.BG3AcquisitionUI,calls};
}
for(const spec of approved){
 test('Batch 2 exact catalogue identity and full strong-ID binding: '+spec.name,()=>{
  const raw=rows.find(x=>key(x)===spec.binding.progressKey);assert.equal(raw.sourceRow,spec.sourceRow);assert.deepEqual(raw.gameIds,spec.binding.gameIds);assert.equal(raw.links.Name,spec.source);
  assert.deepEqual(entryFor(spec).bindings,[spec.binding]);assert.equal(resolver.resolve(itemFor(spec))?.id,spec.entryId);
 });
 test('Batch 2 unknown/malformed/partial strong IDs never fall back: '+spec.name,()=>{
  const item=itemFor(spec);assert.equal(resolver.resolve(item)?.id,spec.entryId);assert.equal(resolver.resolve({...item,gameIds:[...spec.binding.gameIds].reverse()})?.id,spec.entryId);
  for(const changed of [{...item,gameIds:['UNKNOWN_BATCH_2_ID']},{...item,gameIds:[...spec.binding.gameIds,'EXTRA_ID']},{...item,gameIds:[]},{...item,gameIds:null},{...item,act:'ACT 2'},{...item,name:spec.name+' lookalike'},{...item,source:'https://bg3.wiki/wiki/Unknown_Batch_2_Item'}])assert.equal(resolver.resolve(changed),null);
  if(spec.binding.gameIds.length>1)for(const id of spec.binding.gameIds)assert.equal(resolver.resolve({...item,gameIds:[id]}),null);
 });
 test('Batch 2 literal route counts, methods, anchor roles and reviewed coordinates: '+spec.name,()=>{
  assert.deepEqual(entryFor(spec).routes,spec.routes);assert.equal(entryFor(spec).routes.length,spec.routes.length);
  for(const r of entryFor(spec).routes){assert.ok(['exact','reference'].includes(r.coordinateReview.state));assert.ok(r.coordinates);assert.notDeepEqual([r.coordinates.x,r.coordinates.y],[0,0]);assert.equal(r.validity,'current');if(r.coordinateReview.state==='reference')assert.ok(r.coordinateReview.reason.trim());}
 });
 test('Batch 2 pinned primary-source evidence and specific subjects: '+spec.name,()=>{
  const e=entryFor(spec);for(const [i,r] of e.routes.entries()){
   assert.deepEqual(r.sources,spec.routes[i].sources);assert.ok(r.sources.length);
   for(const source of r.sources){const u=new URL(source.url);assert.equal(u.origin,'https://bg3.wiki');assert.equal(u.pathname,'/w/index.php');assert.equal(Number(u.searchParams.get('oldid')),source.revisionId);assert.ok(source.section.trim());}
  }
 });
 test('Batch 2 real desktop/mobile Full keeps Effect then concise Where to find and one Wiki link: '+spec.name,()=>{
  const raw=rows.find(x=>key(x)===spec.binding.progressKey),h=itemHarness([raw],{dataset:data});
  for(const surface of surfaces(h)){
   const details=required(surface,'details'),effects=required(details,'.item-effects'),where=required(details,'.acquisition-enrichment'),grid=required(details,'.detailgrid');
   assert.ok(effects.textContent.includes(raw.description));if(raw.properties)assert.ok(effects.textContent.includes(raw.properties));assert.ok(grid.children.indexOf(effects)<grid.children.indexOf(where));
   assert.equal(required(where,'h4').textContent,'Where to find');assert.equal(where.querySelectorAll('.acquisition-route').length,spec.routes.length);
   for(const r of spec.routes){assert.ok(where.textContent.includes(`X: ${r.coordinates.x} Y: ${r.coordinates.y}`));assert.ok(where.textContent.includes(r.sublocation));}
   assert.equal(where.querySelectorAll('.acquisition-point').length,spec.routes.length);
   for(const heading of where.querySelectorAll('.acquisition-route-heading'))assert.match(heading.textContent,/^(?:Container|Loot|Vendor|Quest reward|Craft|World):/);
   assert.doesNotMatch(where.textContent,/Route \d|Shared location|Prerequisites|References|Notes:/);
   assert.equal(surface.querySelectorAll('a').length,1);assert.equal(required(surface,'.item-reference').getAttribute('href'),spec.source);assert.equal(surface.querySelectorAll('.acquisition-references,.acquisition-reference').length,0);
  }
 });
 for(const mode of ['minimal','light'])test('Batch 2 '+mode+' never constructs enrichment DOM and removes Full on transition: '+spec.name,()=>{
  const raw=rows.find(x=>key(x)===spec.binding.progressKey),h=itemHarness([raw],{dataset:data,mode});assert.equal(h.acquisitionCalls.length,0);assert.deepEqual(clone(ui.render(itemFor(spec),mode)),{acquisitionHtml:'',referencesHtml:''});
  for(const surface of surfaces(h)){required(required(surface,'details'),'summary').click();assert.equal(surface.querySelectorAll('.acquisition-enrichment,.acquisition-coordinate,.acquisition-coordinate-note,.acquisition-navigation,.acquisition-route').length,0);assert.ok(!entireAttributes(surface).includes('coordinateReview'));}
  const state=clone(discovery(h));h.mode('full');assert.equal(surfaces(h).filter(x=>x.querySelector('.acquisition-enrichment')).length,2);h.mode(mode);assert.deepEqual(clone(discovery(h)),state);assert.ok(surfaces(h).every(x=>!x.querySelector('.acquisition-enrichment')));
 });
 test('Batch 2 generated/browser/offline output equals the real canonical renderer: '+spec.name,()=>{
  assert.ok(ui.render(itemFor(spec),'full').acquisitionHtml);const live=browser(),offline=browser(live.ui.offlineSource());
  for(const runtime of [live,offline]){assert.deepEqual(clone(runtime.ui.render(itemFor(spec),'full')),clone(ui.render(itemFor(spec),'full')));assert.deepEqual(runtime.calls,[]);}
 });
 test('Batch 2 cached identity preserves input and never changes progress keys: '+spec.name,()=>{
  const item=itemFor(spec),before=clone(item),h=itemHarness([item],{dataset:data,cached:true});assert.equal(resolver.resolve(h.app.items()[0])?.id,spec.entryId);for(const surface of surfaces(h))assert.equal(surface.querySelectorAll('.acquisition-enrichment').length,1);assert.deepEqual(clone(item),before);
 });
}
const byName=name=>approved.find(s=>s.name===name);
test('Batch 2 adds only fifteen reviewed entries/bindings and sixteen routes without changing the original fifty-five',()=>{
 const scoped={...data,datasetVersion:batch2Snapshot.datasetVersion,entries:data.entries.filter(e=>batch2IDs.has(e.id)).map(withoutAct2Continuations)};assert.deepEqual(scoped,batch2Snapshot);
 assert.equal(scoped.schemaVersion,2);assert.equal(scoped.datasetVersion,'2.2.0-act1.batch2');assert.equal(metadata.validateDataset(data).ok,true);assert.equal(scoped.entries.length,70);
 assert.deepEqual(scoped.entries.slice(0,55),baseline.entries);const additions=scoped.entries.slice(55);assert.deepEqual(additions.map(e=>e.id),approved.map(s=>s.entryId));assert.deepEqual(additions.flatMap(e=>e.bindings),approved.map(s=>s.binding));assert.deepEqual(additions.flatMap(e=>e.routes),approved.flatMap(s=>s.routes));
 assert.equal(scoped.entries.flatMap(e=>e.bindings).length,71);assert.equal(scoped.entries.flatMap(e=>e.routes).length,89);
});
test('Batch 2 closes all coordinate states: six exact, ten reference, no new exceptions or unresolved routes',()=>{
 const scoped=data.entries.filter(e=>batch2IDs.has(e.id)).map(withoutAct2Continuations);const added=scoped.slice(55).flatMap(e=>e.routes),all=scoped.flatMap(e=>e.routes);assert.equal(added.length,16);
 for(const [state,count] of [['exact',6],['reference',10],['not_applicable',0]])assert.equal(added.filter(r=>r.coordinateReview.state===state).length,count);
 assert.equal(added.filter(r=>r.coordinates===null).length,0);for(const [state,count] of [['exact',34],['reference',50],['not_applicable',5]])assert.equal(all.filter(r=>r.coordinateReview.state===state).length,count);assert.equal(all.filter(r=>['pending','conflict','not_documented'].includes(r.coordinateReview.state)).length,0);
});
test('Batch 2 Ritual Axe retains the table pickup and later carried route with different subjects/points and state conditions',()=>{
 const e=entryFor(byName('Ritual Axe'));assert.deepEqual(e.routes.map(r=>r.type),['world','actor_loot']);assert.deepEqual(e.routes.map(r=>[r.coordinates.x,r.coordinates.y,r.coordinates.subject]),[[338,-26,'item'],[334,-21,'location']]);assert.match(JSON.stringify(e.routes[0].conditions),/before|collects/);assert.match(JSON.stringify(e.routes[1].conditions),/collected|leaving/);assert.match(e.routes[1].coordinateReview.reason,/not a fixed position/);assert.doesNotMatch(JSON.stringify(e.routes.map(r=>r.conditions)),/Loviatar|penance|blessing/);
});
test('Batch 2 Joltshooter is one mutually exclusive rescue reward, not a later Duke-rescue requirement',()=>{
 const r=entryFor(byName('The Joltshooter')).routes[0];assert.equal(r.type,'quest_reward');assert.equal(r.actor.name,'Counsellor Florrick');assert.match(JSON.stringify(r.conditions),/Rescue Counsellor Florrick/);assert.match(JSON.stringify(r.conditions),/mutually exclusive/);assert.doesNotMatch(JSON.stringify(r.conditions),/Rescue the Grand Duke|save.*Duke/i);assert.equal(r.coordinates.subject,'interaction');
});
test('Batch 2 Thrinn reward requires returning boots and choosing the armour, not freeing Nere',()=>{
 const r=entryFor(byName('Armour of Uninhibited Kushigo')).routes[0];assert.match(JSON.stringify(r.conditions),/Return Boots of Speed/);assert.match(JSON.stringify(r.conditions),/Alternative to Bracing Band/);assert.doesNotMatch(JSON.stringify(r.conditions),/Nere|kill|cure Thulla/i);assert.equal(r.coordinateReview.state,'reference');assert.deepEqual([r.coordinates.x,r.coordinates.y],[-628,320]);
});
test('Batch 2 Sussur Dagger has one crafting route with plain dagger/bark and an independently sourced furnace reference',()=>{
 const r=entryFor(byName('Sussur Dagger')).routes[0];assert.equal(r.type,'craft');assert.equal(r.coordinates.subject,'crafting_station');assert.deepEqual([r.coordinates.x,r.coordinates.y],[-446,-378]);assert.equal(r.coordinateReview.state,'reference');assert.match(JSON.stringify(r.conditions),/Plain non-magical Dagger/);assert.match(JSON.stringify(r.conditions),/Sussur Tree Bark/);assert.match(JSON.stringify(r.notes),/-477,-378/);assert.equal(entryFor(byName('Sussur Dagger')).routes.length,1);
});
test('Batch 2 vault access preserves Rune reward/loot/pickpocket alternatives without a mandatory Halsin quest',()=>{
 for(const name of ['Sorrow','Robe of Summer']){const r=entryFor(byName(name)).routes[0];assert.match(JSON.stringify(r.conditions),/Rune of the Wolf/);assert.doesNotMatch(JSON.stringify(r.conditions),/Halsin|Rath|kill/);assert.ok(r.sources.some(s=>new URL(s.url).searchParams.get('title')==='Inner_Sanctum'));assert.equal(r.coordinateReview.state,'reference');}
});
test('Batch 2 Helmet corpse is outside the cove; cliff chest/access and sarcophagus/room coordinates stay distinct',()=>{
 const helmet=entryFor(byName('Helmet of Autonomy')).routes[0];assert.equal(helmet.coordinates.space,'Underdark');assert.equal(helmet.coordinates.subject,'corpse');assert.deepEqual([helmet.coordinates.x,helmet.coordinates.y],[82,-241]);
 const shirt=entryFor(byName('Slippery Chain Shirt')).routes[0];assert.deepEqual([shirt.coordinates.x,shirt.coordinates.y],[-400,329]);assert.doesNotMatch(JSON.stringify(shirt.conditions),/BOOOAL|Sacrifice/i);
 const watcher=entryFor(byName("The Watcher's Guide")).routes[0];assert.deepEqual([watcher.coordinates.x,watcher.coordinates.y],[-293,-323]);assert.equal(watcher.conditions,null);
});
test('Batch 2 Aberration Hunters Amulet matches the intended concise Doctor office / carried-by presentation',()=>{
 const s=byName("Aberration Hunters' Amulet"),h=itemHarness([rows.find(r=>r.sourceRow===2)],{dataset:data});
 for(const surface of surfaces(h)){const w=required(surface,'.acquisition-enrichment');assert.ok(w.textContent.includes("Crèche Y'llek · Doctor's Office"));assert.equal(required(w,'.acquisition-coordinate').textContent,'X: 1285 Y: -801');assert.equal(required(w,'.acquisition-route-heading').textContent,'Loot: Carried by Ghustil Stornugoss.');assert.doesNotMatch(w.textContent,/zaith|Githyanki requirement|treatment/i);}
 assert.equal(entryFor(s).routes[0].coordinates.subject,'encounter');assert.equal(entryFor(s).routes[0].coordinateReview.state,'reference');
});
test('Batch 2 mimics are carried loot, guarded ring is carried loot and Blurg is an Act One vendor without invented prerequisites',()=>{
 for(const name of ['Wondrous Gloves','Ring of Arcane Synergy']){const r=entryFor(byName(name)).routes[0];assert.equal(r.type,'actor_loot');assert.equal(r.conditions,null);assert.equal(r.coordinates.subject,'encounter');}
 const r=entryFor(byName("Sunwalker's Gift")).routes[0];assert.equal(r.type,'purchase');assert.equal(r.actor.name,'Blurg');assert.equal(r.conditions,null);assert.deepEqual(r.acts,[1]);
});
test('Batch 2 source discrepancies remain explicit references without averaging actor/table/furnace points',()=>{
 for(const name of ["Aberration Hunters' Amulet",'Armour of Uninhibited Kushigo','Ritual Axe','Sussur Dagger'])for(const r of entryFor(byName(name)).routes){assert.equal(r.coordinateReview.state,'reference');assert.ok(r.sources.length>=2);assert.ok(r.coordinateReview.reason.trim());}
});
test('Batch 2 actual catalogue preserves all keys, classifier memberships, Graceful contexts and retained Battlemage row',()=>{
 const h=itemHarness(catalogue,{dataset:data}),items=Array.from(h.app.items());assert.equal(catalogue.length,556);assert.equal(items.length,555);assert.deepEqual(items.map(key).sort(),[...new Set(catalogue.map(key))].sort());
 for(const [i,act] of ['ACT 1','ACT 2','ACT 3'].entries()){const a=items.filter(x=>x.act===act);assert.equal(a.filter(h.app.vendor).length,[63,50,67][i]);assert.equal(a.filter(x=>h.app.acquisitionFor(x).loot).length,[131,94,125][i]);assert.equal(a.filter(h.app.quest).length,[25,0,0][i]);}
 const cloth=items.filter(x=>x.name.startsWith('The Graceful Cloth'));assert.equal(cloth.length,2);assert.notEqual(key(cloth[0]),key(cloth[1]));const b=items.filter(x=>x.name==="Gloves of Battlemage's Power");assert.equal(b.length,1);assert.equal(b[0].source,catalogue.find(x=>x.sourceRow===54&&x.name===b[0].name).links.Name);
 const checkpointResolver=metadata.createResolver(batch2Snapshot),matched=items.filter(i=>checkpointResolver.resolve(i));assert.equal(matched.length,70);assert.equal(matched.filter(i=>i.act==='ACT 1').length,65);assert.deepEqual(matched.filter(i=>!metadata.createResolver(baseline).resolve(i)).map(key).sort(),approved.map(s=>s.binding.progressKey).sort());
});
for(const mode of ['full','minimal','light'])test('Batch 2 '+mode+' discovery/filter/sort/count state remains identical to the approved baseline',()=>{
 const before=itemHarness(catalogue,{dataset:baseline,mode}),after=itemHarness(catalogue,{dataset:data,mode});assert.deepEqual(clone(discovery(after)),clone(discovery(before)));assert.deepEqual(clone(after.app.items()),clone(before.app.items()));const progress=after.app.progress();after.search('ring');before.search('ring');assert.deepEqual(clone(discovery(after)),clone(discovery(before)));after.mode('full');after.mode(mode);assert.equal(after.app.progress(),progress);
});
test('Batch 2 protected runtime/schema/resolver/renderer/catalogue/PWA/transport files remain byte-identical',()=>{
 for(const file of ['index.html','acquisition-metadata.js','acquisition-ui.js','versioned-progress.js','service-worker.js','manifest.json','tests/fixtures/vendor-catalogue.json','tests/fixtures/vendor-membership.json','scripts/build-acquisition-bundle.cjs'])assert.equal(readFileSync(join(root,file),'utf8'),execFileSync('git',['show',base+':'+file],{cwd:root,encoding:'utf8'}),file);
});
test('Batch 2 deterministic canonical bundle validates before output and embeds only the current data',()=>{
 assert.equal(generateBundle(),generateBundle());assert.equal(generateBundle(),readFileSync(join(root,'assets/acquisition-pilot.js'),'utf8'));const embedded=generateBundle().match(/  const dataset = (\{[^\n]*\});/);assert.ok(embedded);assert.deepEqual(JSON.parse(embedded[1]),data);
});
test('Batch 2 real v5/v6 imports/exports keep exact item keys and other Story data isolated',async()=>{
 const h=storyHarness({userId:null,stories:[{id:'A',name:'Local A',local:true},{id:'B',name:'Local B',local:true}]});h.seed('A',{});h.seed('B',{'other-story':record('skipped')});await h.app.activate('A',{sync:false});
 for(const version of [5,6]){const items=Object.fromEntries(approved.map((s,i)=>[s.binding.progressKey,version===5?'found':i%2?'skipped':'found']));const input=version===5?{progress:Object.fromEntries(approved.map(s=>['ACT 1|'+s.name,true]))}:{formatVersion:2,items};await h.app.import(input,'merge');const output=await h.exportPayload();assert.deepEqual(output.items,items);assert.equal(h.cached('B')['other-story'].status,'skipped');}
});
