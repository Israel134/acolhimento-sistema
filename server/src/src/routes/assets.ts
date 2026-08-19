import { buildCrudRouter } from "../utils/crudFactory";

export default buildCrudRouter({
  table: "assets",
  module: "patrimonios",
  allowedFields: [
    "patrimony_number",
    "name",
    "category",
    "location",
    "responsible",
    "acquisition_date",
    "status",
    "description",
  ],
  searchFields: ["name", "patrimony_number", "location"],
  defaultOrder: "name",
  deleteRoles: ["administrador"],
});
