import io
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, File, HTTPException, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from PIL import Image, UnidentifiedImageError
from rembg import new_session, remove

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger("bg-remover")

# Global session variable for rembg model
rembg_session = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global rembg_session
    logger.info("Initializing rembg u2net session...")
    try:
        rembg_session = new_session("u2net")
        logger.info("rembg u2net session initialized successfully.")
    except Exception as e:
        logger.error(f"Failed to initialize rembg session: {e}", exc_info=True)
        raise e
    yield
    logger.info("Shutting down bg-remover service.")


app = FastAPI(
    title="Background Removal Microservice",
    description="Microservice to remove image backgrounds and return 512x512 WebP images",
    version="1.0.0",
    lifespan=lifespan,
)

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", status_code=status.HTTP_200_OK)
async def health_check():
    return {"status": "ok", "service": "bg-remover"}


@app.post("/remove-bg", response_class=Response)
async def remove_background(image: UploadFile = File(...)):
    """
    Endpoint to remove background from an uploaded image.
    - Accepts multipart image file (field name: 'image')
    - Removes background using rembg
    - Resizes to fit inside 512x512 maintaining aspect ratio
    - Adds transparent padding to reach exactly 512x512 dimensions
    - Returns WebP image with transparency
    """
    try:
        contents = await image.read()
        if not contents:
            logger.warning("Empty file uploaded")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Uploaded file is empty.",
            )

        # Validate image format
        try:
            input_img = Image.open(io.BytesIO(contents))
            input_img.verify()
        except (UnidentifiedImageError, Exception) as e:
            logger.warning(f"Invalid image file '{image.filename}': {e}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid or unsupported image file.",
            )

        logger.info(f"Processing background removal for image: {image.filename}")

        # Process background removal with rembg
        try:
            session = rembg_session if rembg_session is not None else new_session("u2net")
            output_bytes = remove(contents, session=session)
            bg_removed_img = Image.open(io.BytesIO(output_bytes)).convert("RGBA")
        except Exception as e:
            logger.error(f"Error during rembg processing: {e}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to remove background: {str(e)}",
            )

        # Resize image to fit within 512x512 maintaining aspect ratio
        target_size = (512, 512)
        img_copy = bg_removed_img.copy()
        img_copy.thumbnail(target_size, Image.Resampling.LANCZOS)

        # Create transparent canvas (512x512, RGBA with alpha=0)
        canvas = Image.new("RGBA", target_size, (0, 0, 0, 0))

        # Center the resized image on transparent canvas
        offset_x = (target_size[0] - img_copy.width) // 2
        offset_y = (target_size[1] - img_copy.height) // 2
        canvas.paste(img_copy, (offset_x, offset_y), mask=img_copy)

        # Convert canvas to WebP with transparency
        output_buffer = io.BytesIO()
        canvas.save(output_buffer, format="WEBP", lossless=True)
        webp_bytes = output_buffer.getvalue()

        logger.info(f"Successfully processed '{image.filename}'. WebP size: {len(webp_bytes)} bytes.")

        return Response(
            content=webp_bytes,
            media_type="image/webp",
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error in remove_background: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred during image processing.",
        )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=5050, reload=False)
