import { buildCrudRouter } from "../utils/crudFactory";

export default buildCrudRouter({
  table: "collaborators",
  module: "colaboradores",
  allowedFields: ["name", "rh", "registration", "position", "sector", "admission_date", "status"],
  searchFields: ["name", "rh", "registration"],
  defaultOrder: "name",
});
