import { defineComponent } from "vue"

// import Blocklys from "./components/Blocklys"
import CreateBlock from "./components/CreateBlock"

export default defineComponent({
    setup() {
        return () => <div class="w-full p-[10px] space-y-[10px]">
            {/* <Blocklys /> */}
            <CreateBlock />
        </div>
    }
})