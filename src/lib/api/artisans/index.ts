import { artisansCrud } from './artisans-crud';
import { artisansRelations } from './artisans-relations';
import { artisansFilters } from './artisans-filters';
import { artisansStats } from './artisans-stats';
import { artisansAbsences } from './artisans-absences';
import { artisansLifecycle } from './artisans-lifecycle';
import { artisansCounts } from './artisans-counts';
import { artisansSearch } from './artisans-search';

export const artisansApi = {
  ...artisansCrud,
  ...artisansRelations,
  ...artisansFilters,
  ...artisansStats,
  ...artisansAbsences,
  ...artisansLifecycle,
  ...artisansCounts,
  ...artisansSearch,
};
