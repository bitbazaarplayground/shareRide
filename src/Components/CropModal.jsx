import Button from "@mui/material/Button";
import Slider from "@mui/material/Slider";
import { useCallback, useEffect, useState } from "react";
import Cropper from "react-easy-crop";
import getCroppedImg from "../utils/cropImage";
import "./Styles/CropModal.css";

export default function CropModal({ file, onCropComplete, onCancel }) {
  const [imageSrc, setImageSrc] = useState(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);

  // ✅ Properly load image
  useEffect(() => {
    const reader = new FileReader();
    reader.onload = () => setImageSrc(reader.result);
    reader.readAsDataURL(file);
  }, [file]);

  const onCropCompleteInternal = useCallback((_, croppedPixels) => {
    setCroppedAreaPixels(croppedPixels);
  }, []);

  // ✅ Trigger upload to parent
  const handleDone = async () => {
    try {
      const croppedBlob = await getCroppedImg(imageSrc, croppedAreaPixels);
      if (!croppedBlob) {
        console.error("Cropped image is undefined or null.");
        return;
      }

      console.log("Cropped image blob:", croppedBlob);
      onCropComplete(croppedBlob);
    } catch (error) {
      console.error("Cropping failed:", error);
    }
  };

  return (
    <div className="crop-modal-overlay">
      <div className="crop-modal-content">
        <div className="cropper-wrapper">
          {imageSrc && (
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              minZoom={1}
              maxZoom={3}
              aspect={1}
              cropShape="round"
              showGrid={false}
              restrictPosition={true}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropCompleteInternal}
            />
          )}
        </div>

        <div className="slider-container">
          <Slider
            value={zoom}
            min={1}
            max={3}
            step={0.1}
            onChange={(e, z) => setZoom(z)}
            aria-label="Zoom"
          />
        </div>

        <div className="crop-actions">
          <Button variant="outlined" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="contained" onClick={handleDone}>
            Crop & Upload
          </Button>
        </div>
      </div>
    </div>
  );
}
