/**
 * @zamindara/catalog
 *
 * What machines exist and what work they do — the shared vocabulary of the
 * whole product.
 *
 * This package is the single source of truth. `supabase/seed.sql` is
 * generated from it by `npm run gen:seed`, so the database and the app
 * cannot disagree about what a Happy Seeder is. Editing the SQL by hand
 * would reintroduce exactly the divergence this exists to prevent.
 */

export {
  CATEGORY_NAMES,
  MACHINE_BY_CODE,
  MACHINE_TYPES,
} from './machines.js';

export {
  SERVICES,
  SERVICE_BY_CODE,
  servicesForMachines,
  servicesForMonth,
} from './services.js';

export type {
  LocalisedName,
  MachineCategory,
  MachineType,
  PricingUnit,
  Service,
} from './types.js';
