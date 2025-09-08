import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md shadow-md">
        <CardContent className="pt-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:gap-3 mb-4 text-center sm:text-left">
            <AlertCircle className="h-10 w-10 text-red-500 mx-auto sm:mx-0" />
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mt-2 sm:mt-0">
              404 Page Not Found
            </h1>
          </div>

          {/* Message */}
          <p className="mt-2 text-sm sm:text-base text-gray-600">
            Did you forget to add the page to the router?
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
