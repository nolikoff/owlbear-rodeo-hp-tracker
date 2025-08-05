import { useLocalStorage } from "../../../helper/hooks.ts";
import { ID } from "../../../helper/variables.ts";
import { E5Statblock } from "../../../api/e5/useE5Api.ts";
import { PfStatblock } from "../../../api/pf/usePfApi.ts";
import { useMetadataContext } from "../../../context/MetadataContext.ts";

export const About = ({
    about,
    slug,
    defaultOpen,
    hideTitle,
}: {
    about?: string | null;
    slug: string;
    defaultOpen?: boolean;
    hideTitle?: boolean;
}) => {
    const [open, setOpen] = useLocalStorage<boolean>(`${ID}.about.${slug}`, !!defaultOpen);
    return about ? (
        <div className={`about ${hideTitle ? "no-title" : ""}`}>
            {!hideTitle ? <h3>About</h3> : null}
            <button className={`expand ${open ? "open" : null}`} onClick={() => setOpen(!open)}></button>
            <div className={`about-content-wrapper ${open ? "open" : "hidden"}`}>
                <div className={"about-content"}></div>
            </div>
        </div>
    ) : null;
};
