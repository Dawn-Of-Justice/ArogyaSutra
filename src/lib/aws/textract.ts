// ============================================================
// Amazon Textract Integration
// Cloud OCR for medical document digitization
// ============================================================

import {
    TextractClient,
    AnalyzeDocumentCommand,
    type Block,
} from "@aws-sdk/client-textract";
import type { OCRResult, TextRegion, BoundingBox } from "../types/medvision";

// Amplify blocks "AWS_" prefix env vars — use APP_AWS_* workaround.
// Falls back to default credential chain (IAM role / local ~/.aws).
const _appCreds =
    process.env.APP_AWS_ACCESS_KEY_ID && process.env.APP_AWS_SECRET_ACCESS_KEY
        ? { credentials: { accessKeyId: process.env.APP_AWS_ACCESS_KEY_ID, secretAccessKey: process.env.APP_AWS_SECRET_ACCESS_KEY } }
        : {};


const region = process.env.NEXT_PUBLIC_AWS_REGION || "ap-south-1";
const textractClient = new TextractClient({ region, ..._appCreds });

/**
 * Analyzes a document image using Amazon Textract.
 * Handles both printed and handwritten text (FORMS + TABLES features).
 *
 * @param imageBuffer  Document image as ArrayBuffer (JPEG, PNG, PDF)
 * @returns            Structured OCR result with text regions and confidence
 */
export async function analyzeDocument(
    imageBuffer: ArrayBuffer
): Promise<OCRResult> {
    const result = await textractClient.send(
        new AnalyzeDocumentCommand({
            Document: {
                Bytes: new Uint8Array(imageBuffer),
            },
            FeatureTypes: ["FORMS", "TABLES"],
        })
    );

    const blocks = result.Blocks || [];
    const regions = extractTextRegions(blocks);
    const fullText = regions.map((r) => r.text).join("\n");

    // Calculate overall confidence from all LINE blocks
    const lineBlocks = blocks.filter((b) => b.BlockType === "LINE");
    const overallConfidence =
        lineBlocks.length > 0
            ? lineBlocks.reduce((sum, b) => sum + (b.Confidence || 0), 0) /
            lineBlocks.length
            : 0;

    return {
        source: "TEXTRACT",
        fullText,
        regions,
        overallConfidence: Math.round(overallConfidence * 100) / 100,
        pageCount: new Set(blocks.map((b) => b.Page || 1)).size,
        processedAt: new Date().toISOString(),
    };
}

/**
 * Extracts text regions from Textract blocks.
 */
function extractTextRegions(blocks: Block[]): TextRegion[] {
    return blocks
        .filter((block) => block.BlockType === "LINE" && block.Text)
        .map((block) => ({
            text: block.Text!,
            confidence: block.Confidence || 0,
            boundingBox: extractBoundingBox(block),
            pageNumber: block.Page || 1,
        }));
}

/**
 * Converts Textract BoundingBox to our format.
 */
function extractBoundingBox(block: Block): BoundingBox {
    const bbox = block.Geometry?.BoundingBox;
    return {
        left: bbox?.Left || 0,
        top: bbox?.Top || 0,
        width: bbox?.Width || 0,
        height: bbox?.Height || 0,
    };
}
