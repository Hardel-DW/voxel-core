import { generateFabricMod } from "@/converter/fabric";
import { generateForgeMods } from "@/converter/forge-neoforge";
import { generateQuiltMod } from "@/converter/quilt";
import Datapack from "@/core/Datapack";
import { parseZip } from "@/core/engine/utils/zip";
import { DEFAULT_MOD_METADATA, type ModMetadata, ModPlatforms } from "./types";

/**
 * Converts a datapack ZIP file to mod(s) for specified platforms
 * @param datapackZip - Datapack ZIP file to convert
 * @param platforms - Target platforms for conversion
 * @param metadata - Optional metadata for the mod
 * @returns Promise resolving with resulting ZIP as Uint8Array
 */
export async function convertDatapack(datapackZip: File, platforms: ModPlatforms[], metadata?: ModMetadata): Promise<Uint8Array> {
    const files = await parseZip(new Uint8Array(await datapackZip.arrayBuffer()));
    const finalMetadata = metadata || extractMetadata(files, datapackZip.name.replace(/\.zip$/i, ""));
    const modFiles = generateModFiles(finalMetadata, platforms);

    const allFiles = {
        ...files,
        ...Object.fromEntries(Object.entries(modFiles).map(([path, content]) => [path, new TextEncoder().encode(content)]))
    };

    return new Datapack(allFiles).generate([], { isMinified: true });
}

function generateModFiles(metadata: ModMetadata, platforms: ModPlatforms[]) {
    const files: Record<string, string> = {};
    const modId = metadata.id.toLowerCase().replace(/\s+/g, "_");
    const commonData = { ...metadata, id: modId };

    if (platforms.includes(ModPlatforms.FABRIC)) {
        files["fabric.mod.json"] = generateFabricMod(commonData);
    }

    if (platforms.includes(ModPlatforms.QUILT)) {
        files["quilt.mod.json"] = generateQuiltMod(commonData);
    }

    if (platforms.includes(ModPlatforms.FORGE)) {
        files["META-INF/mods.toml"] = generateForgeMods(commonData, [ModPlatforms.FORGE]);
    }

    if (platforms.includes(ModPlatforms.NEOFORGE)) {
        files["META-INF/neoforge.mods.toml"] = generateForgeMods(commonData, [ModPlatforms.NEOFORGE]).replace(
            /updateJSONURL = '(.*?)'/,
            "updateJSONURL = '$1?neoforge=only'"
        );
    }

    return files;
}

/**
 * Extracts metadata from datapack's pack.mcmeta and icon
 * @param files - Datapack files (keys = paths, values = content)
 * @param modName - Name to use for the mod (from zip filename)
 * @returns Extracted metadata combined with default values
 */
export function extractMetadata(files: Record<string, Uint8Array>, modName: string): ModMetadata {
    const iconEntry = Object.keys(files).find((path) => path.match(/^[^/]+\.png$/i));
    let metadata: Partial<ModMetadata> = {};

    try {
        const datapack = new Datapack(files);
        metadata = {
            description: datapack.getDescription(DEFAULT_MOD_METADATA.description),
            version: datapack.getVersion()
        };
    } catch (error) {
        console.error("Error parsing pack.mcmeta", error);
    }

    return {
        ...DEFAULT_MOD_METADATA,
        ...metadata,
        id: modName.toLowerCase().replace(/[^a-z0-9_]/g, "_"),
        name: modName,
        authors: metadata.authors || DEFAULT_MOD_METADATA.authors,
        icon: iconEntry?.split("/").pop()
    };
}
