import { GMGMetadata } from "../../../helper/types.ts";
import { useMetadataContext } from "../../../context/MetadataContext.ts";
import { useTokenListContext } from "../../../context/TokenContext.tsx";
import { useShallow } from "zustand/react/shallow";

export const Statblock = ({ id }: { id: string }) => {
    const room = useMetadataContext(useShallow((state) => state.room));
    const token = useTokenListContext(useShallow((state) => state.tokens?.get(id)));
    const data = token?.data as GMGMetadata;

    return token ? (
        <div className={"statblock-wrapper"}></div>
    ) : null;
};
