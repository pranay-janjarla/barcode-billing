import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  Alert,
  StyleSheet,
  FlatList,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { BarCodeScanner } from "expo-barcode-scanner";
import { useFocusEffect } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { NavigationContainer } from "@react-navigation/native";
import { Button, Input, ListItem, Icon } from "@rneui/themed";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ThemeProvider, createTheme } from "@rneui/themed";
import QRCode from "react-native-qrcode-svg";

const Stack = createNativeStackNavigator();

const theme = createTheme({
  lightColors: {
    primary: "#3498db",
  },
  darkColors: {
    primary: "#2980b9",
  },
  mode: "light",
});

const HomeScreen = ({ navigation }) => {
  const [productName, setProductName] = useState("");
  const [productCost, setProductCost] = useState("");

  const generateBarcode = useCallback(() => {
    if (!productName || !productCost) {
      Alert.alert("Error", "Please enter product name and cost.");
      return;
    }
    navigation.navigate("Barcode", { productName, productCost });
  }, [productName, productCost, navigation]);

  return (
    <View style={styles.container}>
      <Input
        placeholder="Product Name"
        value={productName}
        onChangeText={setProductName}
        leftIcon={
          <Icon name="shopping-cart" type="feather" size={24} color="grey" />
        }
      />
      <Input
        placeholder="Product Cost"
        value={productCost}
        onChangeText={setProductCost}
        keyboardType="numeric"
        leftIcon={
          <Icon name="dollar-sign" type="feather" size={24} color="grey" />
        }
      />
      <Button title="Generate Barcode" onPress={generateBarcode} />
      <Button
        title="Start Scanning"
        onPress={() => navigation.navigate("Scanner")}
        containerStyle={{ marginTop: 10 }}
      />
    </View>
  );
};

const BarcodeScreen = ({ route }) => {
  const { productName, productCost } = route.params;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Generated QR Code:</Text>
      <QRCode
        value={`${productName}-${productCost}`}
        size={200}
        color="black"
        backgroundColor="white"
      />
      <Text style={styles.productInfo}>
        {productName} - ${productCost}
      </Text>
    </View>
  );
};

const ScannerScreen = ({ navigation }) => {
  const [hasPermission, setHasPermission] = useState(null);
  const [scanned, setScanned] = useState(false);
  const [scannedProduct, setScannedProduct] = useState(null);

  useEffect(() => {
    (async () => {
      const { status } = await BarCodeScanner.requestPermissionsAsync();
      setHasPermission(status === "granted");
    })();
  }, []);

  useFocusEffect(
    useCallback(() => {
      setScanned(false);
      setScannedProduct(null);
    }, [])
  );

  const handleBarCodeScanned = useCallback(async ({ data }) => {
    setScanned(true);
    const [name, cost] = data.split("-");
    const newProduct = { name, cost: parseFloat(cost), quantity: 1 };
    setScannedProduct(newProduct);

    try {
      const existingProducts = await AsyncStorage.getItem("scannedProducts");
      let updatedProducts = existingProducts
        ? JSON.parse(existingProducts)
        : [];
      updatedProducts.push(newProduct);
      await AsyncStorage.setItem(
        "scannedProducts",
        JSON.stringify(updatedProducts)
      );
    } catch (error) {
      console.error("Failed to save scanned product:", error);
      Alert.alert("Error", "Failed to save scanned product.");
    }
  }, []);

  const resetScanner = () => {
    setScanned(false);
    setScannedProduct(null);
  };

  if (hasPermission === null) {
    return <Text>Requesting for camera permission</Text>;
  }
  if (hasPermission === false) {
    return <Text>No access to camera</Text>;
  }

  return (
    <View style={styles.container}>
      <BarCodeScanner
        onBarCodeScanned={scanned ? undefined : handleBarCodeScanned}
        style={StyleSheet.absoluteFillObject}
      />
      <View style={styles.overlay}>
        {scanned ? (
          <View>
            <Text style={styles.scanComplete}>Scan Complete!</Text>
            {scannedProduct && (
              <Text style={styles.scanResult}>
                Added: {scannedProduct.name} - ${scannedProduct.cost.toFixed(2)}
              </Text>
            )}
            <Button
              title="Scan Another Product"
              onPress={resetScanner}
              containerStyle={styles.button}
            />
            <Button
              title="View Billing"
              onPress={() => navigation.navigate("Billing")}
              containerStyle={styles.button}
            />
          </View>
        ) : (
          <Text style={styles.scanInstructions}>
            Position the QR code within the camera frame to scan
          </Text>
        )}
      </View>
    </View>
  );
};

const BillingScreen = ({ navigation }) => {
  const [scannedProducts, setScannedProducts] = useState([]);
  const [totalCost, setTotalCost] = useState(0);

  useEffect(() => {
    loadScannedProducts();
  }, []);

  const loadScannedProducts = async () => {
    try {
      const savedProducts = await AsyncStorage.getItem("scannedProducts");
      if (savedProducts) {
        const products = JSON.parse(savedProducts);
        setScannedProducts(products);
        updateTotalCost(products);
      }
    } catch (error) {
      console.error("Failed to load scanned products:", error);
      Alert.alert("Error", "Failed to load scanned products.");
    }
  };

  const updateTotalCost = (products) => {
    const total = products.reduce(
      (sum, product) => sum + product.cost * product.quantity,
      0
    );
    setTotalCost(total);
  };

  const updateProductQuantity = async (index, change) => {
    const updatedProducts = [...scannedProducts];
    updatedProducts[index].quantity = Math.max(
      0,
      updatedProducts[index].quantity + change
    );

    if (updatedProducts[index].quantity === 0) {
      updatedProducts.splice(index, 1);
    }

    setScannedProducts(updatedProducts);
    updateTotalCost(updatedProducts);
    await AsyncStorage.setItem(
      "scannedProducts",
      JSON.stringify(updatedProducts)
    );
  };

  const removeProduct = async (index) => {
    const updatedProducts = scannedProducts.filter((_, i) => i !== index);
    setScannedProducts(updatedProducts);
    updateTotalCost(updatedProducts);
    await AsyncStorage.setItem(
      "scannedProducts",
      JSON.stringify(updatedProducts)
    );
  };

  const completeOrder = () => {
    Alert.alert("Complete Order", `Total: $${totalCost.toFixed(2)}`, [
      {
        text: "Cancel",
        style: "cancel",
      },
      {
        text: "Confirm",
        onPress: async () => {
          await AsyncStorage.removeItem("scannedProducts");
          setScannedProducts([]);
          setTotalCost(0);
          navigation.navigate("Home");
        },
      },
    ]);
  };

  const renderItem = ({ item, index }) => (
    <ListItem bottomDivider>
      <ListItem.Content>
        <ListItem.Title>{item.name}</ListItem.Title>
        <ListItem.Subtitle>
          ${item.cost.toFixed(2)} x {item.quantity}
        </ListItem.Subtitle>
      </ListItem.Content>
      <Button
        title="-"
        onPress={() => updateProductQuantity(index, -1)}
        type="clear"
      />
      <Text>{item.quantity}</Text>
      <Button
        title="+"
        onPress={() => updateProductQuantity(index, 1)}
        type="clear"
      />
      <Button
        title="Remove"
        onPress={() => removeProduct(index)}
        type="clear"
      />
    </ListItem>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Scanned Products:</Text>
      <FlatList
        data={scannedProducts}
        renderItem={renderItem}
        keyExtractor={(item, index) => index.toString()}
        style={styles.list}
      />
      <Text style={styles.totalCost}>Total Cost: ${totalCost.toFixed(2)}</Text>
      <Button
        title="Complete Order"
        onPress={completeOrder}
        containerStyle={styles.completeOrderButton}
      />
    </View>
  );
};

const App = () => {
  return (
    <SafeAreaProvider>
      <ThemeProvider theme={theme}>
        <NavigationContainer>
          <StatusBar style="auto" />
          <Stack.Navigator>
            <Stack.Screen
              name="Home"
              component={HomeScreen}
              options={{ title: "Product Scanner" }}
            />
            <Stack.Screen
              name="Barcode"
              component={BarcodeScreen}
              options={{ title: "Generated Barcode" }}
            />
            <Stack.Screen
              name="Scanner"
              component={ScannerScreen}
              options={{ title: "Scan Products" }}
            />
            <Stack.Screen
              name="Billing"
              component={BillingScreen}
              options={{ title: "Billing" }}
            />
          </Stack.Navigator>
        </NavigationContainer>
      </ThemeProvider>
    </SafeAreaProvider>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 20,
  },
  productInfo: {
    marginTop: 20,
    fontSize: 18,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  scanInstructions: {
    color: "white",
    fontSize: 18,
    textAlign: "center",
  },
  scanComplete: {
    color: "white",
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 20,
    textAlign: "center",
  },
  scanResult: {
    color: "white",
    fontSize: 18,
    marginBottom: 20,
    textAlign: "center",
  },
  button: {
    marginTop: 10,
    width: 200,
  },
  totalCost: {
    fontSize: 18,
    fontWeight: "bold",
    marginTop: 20,
  },
  list: {
    width: "100%",
  },
  completeOrderButton: {
    marginTop: 20,
    width: "100%",
  },
});

export default App;
