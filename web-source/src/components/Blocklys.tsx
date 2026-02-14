import { Card, Table } from "ant-design-vue";
import { defineComponent } from "vue";

export default defineComponent({
  setup() {
    return () => (
      <Card>
        <Table></Table>
      </Card>
    );
  },
});
