import { useEffect, useState } from "react";
import { useRollLogContext } from "../../../context/RollLogContext.tsx";
import { RollLog } from "./RollLog.tsx";
import { useMetadataContext } from "../../../context/MetadataContext.ts";
import { DiceSettings } from "./DiceSettings.tsx";
import OBR from "@owlbear-rodeo/sdk";
import { diceModal } from "../../../helper/variables.ts";
import { DiceRoomButtons } from "./DiceRoomButtons.tsx";
import { CopySvg } from "../../svgs/CopySvg.tsx";
import { IUser } from "dddice-js";
import { usePlayerContext } from "../../../context/PlayerContext.ts";
import { updateRoomMetadata } from "../../../helper/helpers.ts";
import { useShallow } from "zustand/react/shallow";

export const DiceRoom = ({ className, user }: { className?: string; user?: IUser }) => {
    const room = useMetadataContext(useShallow((state) => state.room));
    const clear = useRollLogContext(useShallow((state) => state.clear));

    const [settings, setSettings] = useState<boolean>(false);
    const [open, setOpen] = useState<boolean>(false);
    const playerContext = usePlayerContext();

    useEffect(() => {
        if (!open) {
            setSettings(false);
        }
    }, [open]);

    return (
        <b></b>      
    );
};
