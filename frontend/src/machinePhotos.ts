import type { ImageSourcePropType } from 'react-native';

/**
 * A photo per machine type, for the picker: a farmer-captain recognises a
 * combine by sight faster than by name.
 *
 * These are DUMMY photos for now (frontend/assets/machines/<code>.jpg).
 * Replace any file with a real photo of the same name, about 240x160, and it
 * shows with no code change. Static requires: Metro bundles only what it can see.
 */
export const MACHINE_PHOTOS: Record<string, ImageSourcePropType> = {
  tractor: require('../assets/machines/tractor.jpg'),
  rotavator: require('../assets/machines/rotavator.jpg'),
  cultivator: require('../assets/machines/cultivator.jpg'),
  disc_harrow: require('../assets/machines/disc_harrow.jpg'),
  mb_plough: require('../assets/machines/mb_plough.jpg'),
  sub_soiler: require('../assets/machines/sub_soiler.jpg'),
  laser_leveller: require('../assets/machines/laser_leveller.jpg'),
  seed_drill: require('../assets/machines/seed_drill.jpg'),
  happy_seeder: require('../assets/machines/happy_seeder.jpg'),
  super_seeder: require('../assets/machines/super_seeder.jpg'),
  zero_till: require('../assets/machines/zero_till.jpg'),
  ridger: require('../assets/machines/ridger.jpg'),
  combine: require('../assets/machines/combine.jpg'),
  straw_reaper: require('../assets/machines/straw_reaper.jpg'),
  thresher: require('../assets/machines/thresher.jpg'),
  baler: require('../assets/machines/baler.jpg'),
  cotton_shredder: require('../assets/machines/cotton_shredder.jpg'),
  boom_sprayer: require('../assets/machines/boom_sprayer.jpg'),
  htp_sprayer: require('../assets/machines/htp_sprayer.jpg'),
  trolley: require('../assets/machines/trolley.jpg'),
  jcb: require('../assets/machines/jcb.jpg'),
};
