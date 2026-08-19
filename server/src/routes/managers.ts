import { buildCrudRouter } from "../utils/crudFactory";

export default buildCrudRouter({
  table: "managers",
  module: "gestores",
  allowedFields: ["name", "rh", "registration", "position", "sector", "shift_type", "status"],
  searchFields: ["name", "rh", "registration"],
  defaultOrder: "name",
});
