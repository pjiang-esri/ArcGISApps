<%@page language="java" session="false"%>
<%@page import="java.net.*,java.io.*,javax.net.ssl.*, java.security.cert.*"%>
<%!String[] serverUrls = {
			//"<url>[,<token>]"
			//For ex. (secured server): "http://myserver.mycompany.com/arcgis/rest/services,ayn2C2iPvqjeqWoXwV6rjmr43kyo23mhIPnXz2CEiMA6rVu0xR0St8gKsd0olv8a"
			//For ex. (non-secured server): "http://sampleserver1.arcgisonline.com/arcgis/rest/services"
			"http://services.arcgis.com/", 
			"https://services.arcgis.com/",
			"arcgis/rest/services" 
	};
%>
<%
	try {
		String reqUrl = request.getQueryString();
		boolean allowed = false;
		String token = null;
		for (String surl : serverUrls) {
			String[] stokens = surl.split("\\s*,\\s*");
			if (reqUrl.toLowerCase().contains(stokens[0].toLowerCase())) {
				allowed = true;
				if (stokens.length >= 2 && stokens[1].length() > 0)
					token = stokens[1];
				break;
			}
		}

		if (!allowed) {
			response.setStatus(403);
			return;
		}
		if (token != null) {
			reqUrl = reqUrl + (reqUrl.indexOf("?") > -1 ? "&" : "?") + "token=" + token;
		}

		URL url = new URL(reqUrl);

		if (reqUrl.startsWith("https://")) {
        	TrustManager[] trustAllCerts = new TrustManager[] { 
        		new X509TrustManager() {
            		public java.security.cert.X509Certificate[] getAcceptedIssuers() {
                		return null;
            		}
            		public void checkClientTrusted(X509Certificate[] certs, String authType) {
            		}
            		public void checkServerTrusted(X509Certificate[] certs, String authType) {
            		}
        		} 
        	};

			HostnameVerifier allHostsValid = new HostnameVerifier() {
				public boolean verify(String hostname, SSLSession session) {
					return true;
				}
			};
	
			final SSLContext sc = SSLContext.getInstance("SSL");
			sc.init(null, trustAllCerts, new java.security.SecureRandom());

			HttpsURLConnection.setDefaultHostnameVerifier(allHostsValid);
			HttpsURLConnection httpsConn = (HttpsURLConnection) url.openConnection();
			httpsConn.setSSLSocketFactory(sc.getSocketFactory());
			
			httpsConn.setDoOutput(true);
			httpsConn.setRequestMethod(request.getMethod());
			if (request.getContentType() != null) {
				httpsConn.setRequestProperty("Content-Type", request.getContentType());
			}

			int clength = request.getContentLength();
			if (clength > 0) {
				httpsConn.setDoInput(true);
				InputStream istream = request.getInputStream();
				OutputStream ostream = httpsConn.getOutputStream();

				final int length = 5000;
				byte[] bytes = new byte[length];
				int bytesRead = 0;
				while ((bytesRead = istream.read(bytes, 0, length)) > 0) {
					ostream.write(bytes, 0, bytesRead);
				}
			}
	
			out.clear();
			out = pageContext.pushBody();
			OutputStream outputStream = response.getOutputStream();
			response.setContentType(httpsConn.getContentType());
			InputStream inputStream = httpsConn.getInputStream();
			
			final int length = 5000;
			byte[] bytes = new byte[length];
			int bytesRead = 0;
			while ((bytesRead = inputStream.read(bytes, 0, length)) > 0) {
				outputStream.write(bytes, 0, bytesRead);
			}
		} else {
			HttpURLConnection httpConn = (HttpURLConnection) url.openConnection();
			httpConn.setDoOutput(true);
			httpConn.setRequestMethod(request.getMethod());
			if (request.getContentType() != null) {
				httpConn.setRequestProperty("Content-Type", request.getContentType());
			}

			int clength = request.getContentLength();
			if (clength > 0) {
				httpConn.setDoInput(true);
				InputStream ins = request.getInputStream();
				OutputStream outs = httpConn.getOutputStream();

				final int length = 5000;
				byte[] bytes = new byte[length];
				int bytesRead = 0;
				while ((bytesRead = ins.read(bytes, 0, length)) > 0) {
					outs.write(bytes, 0, bytesRead);
				}
			}

			out.clear();
			out = pageContext.pushBody();
			OutputStream ostream = response.getOutputStream();
			response.setContentType(httpConn.getContentType());
			InputStream istream = httpConn.getInputStream();
			
			final int length = 5000;
			byte[] bytes = new byte[length];
			int bytesRead = 0;
			while ((bytesRead = istream.read(bytes, 0, length)) > 0) {
				ostream.write(bytes, 0, bytesRead);
			}
		}
	} catch (Exception e) {
		response.setStatus(500);
	}
%>
