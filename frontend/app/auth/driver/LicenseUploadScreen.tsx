import {
  View,
  Text,
  Alert,
  ScrollView,
  ActivityIndicator,
  Image,
} from "react-native";
import { useRouter } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Button from "../../../components/Button";
import ProgressSteps from "../../../components/ProgressSteps";
import { CameraView } from "../../../components/CameraView";
import Toast from "../../../components/Toast";
import { Stack } from "expo-router";
import {
  uploadLicense,
  updatePhotoConsent,
} from "../../../services/verificationService";
import { useAuth } from "../../../context/AuthContext";
import React, { useState } from "react";

type ViewMode = "selection" | "camera" | "uploading";

export default function LicenseUploadScreen() {
  const router = useRouter();
  const { registerAsDriver } = useAuth();
  const [viewMode, setViewMode] = useState<ViewMode>("selection");
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [toastType, setToastType] = useState<"success" | "error">("success");

  const showToast = (message: string, type: "success" | "error") => {
    setToastMessage(message);
    setToastType(type);
    setToastVisible(true);
  };

  const correctImageOrientation = async (uri: string): Promise<string> => {
    try {
      const imageInfo = await ImageManipulator.manipulateAsync(uri, [], {
        format: ImageManipulator.SaveFormat.JPEG,
      });

      if (imageInfo.height > imageInfo.width) {
        console.log("📸 Image is vertical, rotating to horizontal...");
        const rotated = await ImageManipulator.manipulateAsync(
          uri,
          [{ rotate: 90 }],
          { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG },
        );
        return rotated.uri;
      }

      return uri;
    } catch (error) {
      console.warn("Error correcting image orientation:", error);
      return uri;
    }
  };

  const handleTakePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission Required", "Camera permission is required");
      return;
    }
    setViewMode("camera");
  };

  const handleChooseFromGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission Required", "Gallery permission is required");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      const correctedUri = await correctImageOrientation(result.assets[0].uri);
      setImageUri(correctedUri);
    }
  };

  const handleCapture = async (uri: string) => {
    const correctedUri = await correctImageOrientation(uri);
    setImageUri(correctedUri);
    setViewMode("selection");
  };

  const handleRetake = () => {
    setImageUri(null);
  };

  /**
   * Analyse l'erreur et retourne un message user-friendly
   */
  const parseUploadError = (error: any): string => {
    const errorMsg = error?.error || error?.message || "";
    const errorDetails = error?.details || "";

    if (
      errorMsg.includes("Could not extract NIN") ||
      errorMsg.includes("not a valid driver")
    ) {
      return "This is not a valid driver's license. Please upload your driving license.";
    }

    if (errorMsg.includes("OCR service is not available")) {
      return "License verification service is temporarily unavailable.";
    }

    if (errorDetails.includes("timeout") || errorMsg.includes("timeout")) {
      return "License analysis timeout. Please try again with a clearer photo.";
    }

    return errorMsg || "License verification failed. Please try again.";
  };

  /**
   * Upload et analyse de la license
   */
  const handleConfirmAndUpload = async () => {
    if (!imageUri) return;
    console.log("🚀 [STEP 0] Starting Upload Process");
    setUploading(true);
    setViewMode("uploading");

    try {
      // 1. Récupérer les données temporaires
      const registrationDataStr = await AsyncStorage.getItem(
        "tempRegistrationData",
      );
      console.log(
        "📍 [STEP 1] Temp Data in Storage:",
        registrationDataStr ? "FOUND" : "NOT FOUND",
      );
      if (!registrationDataStr) {
        Alert.alert("Error", "Missing registration data. Please start over.");
        router.replace("/auth/driver/RegisterDriverScreen");
        return;
      }
      const registrationData = JSON.parse(registrationDataStr);

      // 2. Obtenir l'ID de l'utilisateur
      let userId: number;
      let currentToken: string | null = null;
      const existingUserData = await AsyncStorage.getItem("user");
      console.log(
        "📍 [STEP 2] Existing User Check:",
        existingUserData ? "YES" : "NO (Registering new)",
      );
      if (existingUserData) {
        userId = JSON.parse(existingUserData).id;
        const storedToken = await AsyncStorage.getItem("token"); // adjust key to match yours

        currentToken = storedToken;
      } else {
        const registerResult = await registerAsDriver(registrationData);
        if (!registerResult.success) {
          throw new Error(registerResult.message || "Account creation failed");
        }

        currentToken = registerResult.token ?? null;

        const newUserStr = await AsyncStorage.getItem("user");
        if (!newUserStr) throw new Error("Session creation failed");
        userId = JSON.parse(newUserStr).id;
      }

      // 3. Consentement photo
      console.log("🔹 Setting photo consent for user:", userId);
      await updatePhotoConsent({ userId, hasAccepted: true });

      // 4. Upload et analyse de la license
      console.log("🔹 Uploading and analyzing license...");
      console.log("📍 [STEP 4] TRIGGERING AXIOS UPLOAD...");
      console.log("   - URI:", imageUri);
      console.log("   - Token present:", !!currentToken);
      const licenseResult = await uploadLicense(
        userId,
        imageUri,
        currentToken as any,
      );
      console.log(
        "📍 [STEP 5] SERVER RESPONSE RECEIVED:",
        licenseResult.success ? "SUCCESS" : "FAILED",
      );
      if (!licenseResult.success) {
        const errorMessage = parseUploadError(licenseResult);
        console.warn(" Upload License Logic Error:", errorMessage);
        setViewMode("selection");
        showToast(errorMessage, "error");
        return;
      }

      // 5. Finalisation - SUCCESS
      await AsyncStorage.removeItem("tempRegistrationData");
      console.log("🎉 [FINAL STEP] Process Complete, redirecting...");
      // ✅ AFFICHER TOAST SUCCESS (3 secondes puis navigation)

      setViewMode("selection");
      showToast("License verified successfully!", "success");

      // Navigation après 3 secondes
      setTimeout(() => {
        router.push("./SelfieScreen");
      }, 3000);
    } catch (error: any) {
      console.warn("🔴 [FATAL ERROR] Catch Block Triggered:");
      console.warn("- Name:", error.name);
      console.warn("- Message:", error.message);
      console.warn(
        "- Config:",
        error.config ? "URL: " + error.config.url : "No Config",
      );
      console.warn("❌ License upload error:", error);

      //  AFFICHER TOAST ERREUR
      setViewMode("selection");
      showToast(error.message || "An error occurred", "error");
      setImageUri(null);
    } finally {
      setUploading(false);
    }
  };

  if (viewMode === "camera") {
    return (
      <CameraView
        mode='license'
        onCapture={handleCapture}
        onCancel={() => setViewMode("selection")}
      />
    );
  }

  if (viewMode === "uploading") {
    return (
      <React.Fragment>
        <Stack.Screen options={{ title: "License Upload" }} />
        <View className='flex-1 bg-white justify-center items-center px-8'>
          <ActivityIndicator size='large' color='#000' />

          <View className='mt-8 items-center'>
            <MaterialIcons name='badge' size={64} color='#000' />

            {/* <Text className='text-xl font-semibold text-black mt-6 mb-2 text-center'>
            Analyzing Your License
          </Text> */}

            <Text className='text-sm text-gray-600 mb-2 text-center px-4'>
              Stay tuned while we verify your driver's license.
            </Text>

            <Text className='text-xs text-gray-500 italic text-center px-4'>
              This process may take up to 2 minute. Please ensure you have a
              stable internet connection.
            </Text>
          </View>
        </View>
      </React.Fragment>
    );
  }

  return (
    <View className='flex-1 bg-white'>
      <Stack.Screen options={{ title: "License Upload" }} />
      {/* Toast Notification */}
      <Toast
        visible={toastVisible}
        message={toastMessage}
        type={toastType}
        onHide={() => setToastVisible(false)}
        duration={toastType === "success" ? 3000 : 6000}
      />

      {/* Progress Steps */}
      <ProgressSteps currentStep={2} />

      <ScrollView
        className='flex-1'
        contentContainerStyle={{ paddingHorizontal: 20 }}>
        {/* Icon */}
        <View className='items-center mt-8 mb-6'>
          <View className='w-28 h-28 rounded-full bg-black/5 justify-center items-center'>
            <MaterialIcons name='badge' size={64} color='#000' />
          </View>
        </View>

        <Text className='text-2xl font-bold text-black text-center mb-3'>
          Upload Your License
        </Text>
        <Text className='text-sm text-gray-500 text-center mb-6 px-4 leading-5'>
          We'll use this to verify your identity.
        </Text>


        <View className='rounded-2xl p-5 mb-6 border bg-zinc-50 border-l-4 border-l-black border-gray-300'>
          {[
            "Place your license on a flat, white surface with all four corners visible.",
            "Use natural or bright indoor light, avoid shadows and glare on the card.",
            "Hold the camera steady and make sure all text is sharp and readable.",
            "Fill the frame with your license so no details are cut off.",
          ].map((tip, i) => (
            <View key={i} className='flex-row items-start mb-4'>
              <Text className='text-sm font-bold text-black mr-3 mt-0.5'>
                {i + 1}.
              </Text>
              <Text className='flex-1 text-sm text-gray-700 leading-5'>
                {tip}
              </Text>
            </View>
          ))}
        </View>

        {/* Image Display Area */}
        <View className='justify-center items-center mb-8'>
          <View className='w-full max-w-sm aspect-[16/10] rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 justify-center items-center overflow-hidden'>
            {imageUri ? (
              <Image
                source={{ uri: imageUri }}
                style={{ width: "100%", height: "100%" }}
                resizeMode='contain'
              />
            ) : (
              <>
                <MaterialIcons name='credit-card' size={80} color='#CBD5E1' />
                <Text className='text-sm text-gray-500 mt-3'>
                  Your license will appear here
                </Text>
              </>
            )}
          </View>
        </View>
      </ScrollView>

      {/* Action Buttons */}
      <View className='p-5 border-t border-gray-200 bg-white'>
        {imageUri ? (
          <>
            <Button
              title='Use Photo'
              onPress={handleConfirmAndUpload}
              variant='primary'
              loading={uploading}
              disabled={uploading}
              style={{}}
            />
            <View className='h-3' />
            <Button
              title='Retake'
              onPress={handleRetake}
              variant='secondary'
              loading={uploading}
              disabled={uploading}
              style={{}}
            />
          </>
        ) : (
          <>
            <Button
              title='Take Photo'
              onPress={handleTakePhoto}
              variant='primary'
              loading={uploading}
              disabled={uploading}
              style={{}}
            />
            <View className='h-3' />
            <Button
              title='Choose from Gallery'
              onPress={handleChooseFromGallery}
              variant='secondary'
              loading={uploading}
              disabled={uploading}
              style={{}}
            />
          </>
        )}
      </View>
    </View>
  );
}
