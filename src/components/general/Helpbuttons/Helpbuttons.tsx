import OBR from "@owlbear-rodeo/sdk";
import {
    settingsModal,
} from "../../../helper/variables.ts";
import { usePlayerContext } from "../../../context/PlayerContext.ts";
import Tippy from "@tippyjs/react";
import { SettingsSvg } from "../../svgs/SettingsSvg.tsx";

type HelpButtonsProps = {
    ignoredChanges?: boolean;
    setIgnoredChange?: (ignoredChanges: boolean) => void;
};

export const Helpbuttons = (props: HelpButtonsProps) => {
    if (props.setIgnoredChange !== undefined && props.ignoredChanges !== undefined) {
        props.setIgnoredChange(false);
    }
    
    const playerContext = usePlayerContext();
    
    return (
        <div className={"help-buttons"}>
            {playerContext.role == "GM" ? (
                <Tippy content={"Open Settings"}>
                    <button
                        className={"settings-button top-button"}
                        onClick={async () => {
                            let width = 600;
                            let height = 900;
                            try {
                                width = await OBR.viewport.getWidth();
                                height = await OBR.viewport.getHeight();
                            } catch {}
                            await OBR.modal.open({
                                ...settingsModal,
                                width: Math.min(500, width * 0.9),
                                height: Math.min(800, height * 0.9),
                            });
                        }}
                        title={"Settings"}
                    >
                        <SettingsSvg />
                    </button>
                </Tippy>
            ) : null}
        </div>
    );
};
