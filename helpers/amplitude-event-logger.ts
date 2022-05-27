import Amplitude from "@amplitude/node";
import { logger } from "./logger";
import { enableAmplitudeLogging } from "../config";

// Amplitude is a web analytics system. Learn more at https://amplitude.com
// We use it to simply measure get and post requests to the RedStone Http Api
// and build nice analytics charts

// Check the analytics dashboard using the link below
// https://analytics.amplitude.com/limestone/dashboard/ttoropr


export const logEvent = ({
  eventName,
  eventProps,
  ip,
}) => {
  if (enableAmplitudeLogging) {
    const client = Amplitude.init("4990f7285c58e8a009f7818b54fc01eb");

    logger.info(
      `Logging event "${eventName}" in amplitude for ip: "${ip}". With props: `
      + JSON.stringify(eventProps));
    client.logEvent({
      event_type: eventName,
      user_id: ip, // Currently we use ip address from request as a unique identifier
      // user_id: 'datamonster@gmail.com', // Maybe in future we will use some access tokens as user ids
      // location_lat: 37.77,
      // location_lng: -122.39,
      ip,
      event_properties: eventProps,
    });
  }
};
