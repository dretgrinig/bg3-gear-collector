/* Independent public identities; every graph byte is fabricated. */
'use strict';
const cases=Object.freeze([
 [0,'head','UNI_UND_ARM_ShadowOfMenzoberranzan','act 1|shadow of menzoberranzan'],
 [2,'cloak','MAG_Critical_HidingCritical_Cloak','act 3|shade-slayer cloak'],
 [4,'offhand','MAG_PHB_OfLifestealing_Shortsword','act 2|sword of life stealing'],
 [4,'offhand','MAG_OfShielding_Shield','act 3|shield of shielding'],
 [4,'offhand','MAG_Steadfast_Shield',"act 3|swires' sledboard"],
 [5,'rangedMain','MAG_Orthon_Hellfire_HandCrossbow','act 2|hellfire hand crossbow'],
 [5,'rangedMain','MAG_Fire_IncreasePiercingDamageToBurning_HandCrossbow','act 1|firestoker'],
 [5,'rangedMain','MAG_WATCHER_Human_Crossbow','act 3|hellfire engine crossbow'],
 [9,'feet','MAG_Gortash_Boots','act 3|tyrannical jackboots'],
 [10,'hands','MAG_OfTheBalancedHands_Gloves','act 2|gloves of the balanced hands'],
 [11,'amulet','MAG_SpectatorEye_Amulet','act 1|the spectator eyes'],
 [7,'ring1','MAG_Harpers_RingOfTwilight','act 2|ring of twilight'],
 [12,'ring2','UNI_MassHealRing','act 1|the whispering promise'],
 [3,'weapon','MAG_PHB_OfSpeed_Scimitar','act 3|belm'],
 [3,'weapon','MAG_PHB_DwarvenThrower_Warhammer','act 3|dwarven thrower']
].map(Object.freeze));
module.exports={cases};
