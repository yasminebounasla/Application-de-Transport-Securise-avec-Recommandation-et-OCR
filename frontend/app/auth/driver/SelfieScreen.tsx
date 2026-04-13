import React, { useState } from "react";
import { View, Text, ScrollView, ActivityIndicator, Image } from "react-native";
import { useRouter } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Button from "../../../components/Button";
import ProgressSteps from "../../../components/ProgressSteps";
import { CameraView } from "../../../components/CameraView";
import Toast from "../../../components/Toast";
import { uploadSelfie } from "../../../services/verificationService";
import { Stack } from "expo-router";

type ViewMode = "selection" | "camera" | "uploading";

export default function SelfieScreen() {
  const router = useRouter();
  const [viewMode, setViewMode] = useState<ViewMode>("selection");
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  // Toast states
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [toastType, setToastType] = useState<"success" | "error">("success");

  const showToast = (message: string, type: "success" | "error") => {
    setToastMessage(message);
    setToastType(type);
    setToastVisible(true);
  };

  const handleTakePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      showToast("Camera permission required", "error");
      return;
    }
    setViewMode("camera");
  };

  // ========== 🔴 DÉBUT CODE TEMPORAIRE - À SUPPRIMER PLUS TARD ==========
  const handleChooseFromGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      showToast("Gallery permission required", "error");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 1,
      aspect: [1, 1],
    });

    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
    }
  };
  // ========== 🔴 FIN CODE TEMPORAIRE ==========

  const handleCapture = (uri: string) => {
    setImageUri(uri);
    setViewMode("selection");
  };

  const handleRetake = () => {
    setImageUri(null);
    setViewMode("selection");
  };

  const handleConfirmAndVerify = async () => {
    if (!imageUri) return;

    setUploading(true);
    setViewMode("uploading");

    try {
      const userDataStr = await AsyncStorage.getItem("user");

      if (!userDataStr) {
        showToast("Session expired. Please login again.", "error");
        setUploading(false);
        setViewMode("selection");
        setTimeout(() => {
          router.replace("/auth/driver/RegisterDriverScreen");
        }, 2000);
        return;
      }

      const userData = JSON.parse(userDataStr);
      const userId = userData.id;

      console.log("🔹 Uploading selfie and verifying face...");

      const selfieResult = await uploadSelfie(userId, imageUri);

      if (!selfieResult.success) {
        //  ERREUR - Toast rouge pendant 8 secondes
        setViewMode("selection");
        setImageUri(null);

        const errorMsg =
          selfieResult.data?.userMessage ||
          selfieResult.error ||
          "Face verification failed. Please try again.";

        showToast(errorMsg, "error");
        return;
      }

      console.log("✅ Selfie uploaded and face verified");

      const { data } = selfieResult;
      const isApproved = data?.isApproved || false;

      if (isApproved) {
        console.log("✅ Verification successful - navigating to home");
        setViewMode("selection");
        showToast("Face verified successfully, ", "success");

        // Wait 3 seconds before redirecting
        setTimeout(() => {
          router.replace("/driver/ProfileSetupScreen");
        }, 2000);
      } else {
        setViewMode("selection");
        setImageUri(null);

        const userMsg =
          data?.userMessage ||
          "Your face doesn't match the license photo. Please try again with better lighting.";

        showToast(userMsg, "error");
      }
    } catch (error: any) {
      console.error("❌ Selfie upload error:", error);
      setViewMode("selection");
      setImageUri(null);
      showToast("An error occurred. Please try again.", "error");
    } finally {
      setUploading(false);
    }
  };

  if (viewMode === "camera") {
    return (
      <CameraView
        mode='selfie'
        onCapture={handleCapture}
        onCancel={() => setViewMode("selection")}
      />
    );
  }

  if (viewMode === "uploading") {
    return (
      <React.Fragment>
        <Stack.Screen options={{ title: "Take a Selfie" }} />
        <View className='flex-1 bg-white justify-center items-center px-8'>
          <ActivityIndicator size='large' color='#000' />

          <View className='mt-8 items-center'>
            <MaterialIcons name='how-to-reg' size={64} color='#000' />

            <Text className='text-xl font-semibold text-black mt-6 mb-2 text-center'>
              Verifying Your Face
            </Text>

            <Text className='text-xs text-gray-500 italic text-center px-4'>
              This may take a few seconds
            </Text>
          </View>
        </View>
      </React.Fragment>
    );
  }

  return (
    <View className='flex-1 bg-white'>
      <Stack.Screen options={{ title: "Take a Selfie" }} />
      {/* Toast Notification */}
      <Toast
        visible={toastVisible}
        message={toastMessage}
        type={toastType}
        onHide={() => setToastVisible(false)}
        duration={toastType === "error" ? 8000 : 3000}
      />

      {/* Progress Steps */}
      <ProgressSteps currentStep={3} />

      <ScrollView
        className='flex-1'
        contentContainerStyle={{ paddingHorizontal: 20 }}>
        {/* Icon */}
        <View className='items-center mt-8 mb-6'>
          <View className='w-28 h-28 rounded-full bg-gray-100 justify-center items-center'>
            <MaterialIcons name='face' size={79} color='#000' />
          </View>
        </View>

        <Text className='text-3xl font-bold text-black text-center mb-3'>
          Take a Selfie
        </Text>
        <Text className='text-sm text-gray-500 text-center mb-6 px-4 leading-5'>
          Your profile photo helps people recognize you. Once submitted, it can
          only be changed in limited circumstances.
        </Text>



        <View className='rounded-2xl p-5 mb-6 border border-gray-200 border-l-4 border-l-gray bg-zinc-50'>
          {[
            "Face the camera directly with your eyes and mouth clearly visible.",
            "Make sure the photo is well lit, free of glare and in focus.",
            "Face a window or use soft indoor light.",
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

        {/* Photo Placeholder / Preview */}
        <View className='justify-center items-center mb-8'>
          <View className='w-48 h-48 rounded-full border-2 border-dashed border-gray-300 bg-gray-50 justify-center items-center overflow-hidden'>
            {imageUri ? (
              <Image
                source={{ uri: imageUri }}
                style={{ width: "100%", height: "100%", borderRadius: 9999 }}
                resizeMode='cover'
              />
            ) : (
              <MaterialIcons name='person' size={80} color='#CBD5E1' />
            )}
          </View>
        </View>
      </ScrollView>

      {/* Action Buttons */}
      <View className='p-5 border-t border-gray-200 bg-white'>
        {imageUri ? (
          <View className='space-y-3'>
            <Button
              title='Use Photo'
              onPress={handleConfirmAndVerify}
              variant='primary'
              loading={uploading}
              disabled={uploading}
              style={{}}
            />
            <Button
              title='Retake'
              onPress={handleRetake}
              variant='secondary'
              disabled={uploading}
              style={{}}
            />
          </View>
        ) : (
          // ========== 🔴 DÉBUT CODE TEMPORAIRE - BUTTONS ==========
          <View className='space-y-3'>
            <Button
              title='Take Selfie'
              onPress={handleTakePhoto}
              variant='primary'
              loading={uploading}
              disabled={uploading}
              style={{}}
            />
            <Button
              title='Choose from Gallery'
              onPress={handleChooseFromGallery}
              variant='secondary'
              disabled={uploading}
              style={{}}
            />
          </View>
          // ========== 🔴 FIN CODE TEMPORAIRE - BUTTONS ==========

          // ========== ✅ CODE FINAL (DÉCOMMENTE QUAND TU SUPPRIMES LE TEMPORAIRE) ==========
          // <Button
          //   title='Take Selfie'
          //   onPress={handleTakePhoto}
          //   variant='primary'
          //   loading={uploading}
          //   disabled={uploading}
          //   style={{}}
          // />
          // // ========== ✅ FIN CODE FINAL ==========
        )}
      </View>
    </View>
  );
}
